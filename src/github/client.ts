import type { ProjectFile } from '../types';
import { pool, sleep } from '../lib/util';

export class GithubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface GhDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const API = 'https://api.github.com';

export const REQUIRED_PERMISSIONS = [
  'Contents: Read and write',
  'Metadata: Read',
  'Administration: Read and write (create repositories)',
  'Pages: Read and write',
  'Actions: Read and write',
  'Workflows: Read and write',
];

function b64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export interface RunInfo {
  id: number;
  status: string;
  conclusion: string | null;
  url: string;
}

export class GithubClient {
  private f: typeof fetch;
  private wait: (ms: number) => Promise<void>;
  constructor(private token: string, deps: GhDeps = {}) {
    this.f = deps.fetch ?? fetch;
    this.wait = deps.sleep ?? sleep;
  }

  private async req<T = any>(method: string, path: string, body?: unknown, opts: { okStatus?: number[] } = {}): Promise<{ data: T; headers: Headers; status: number }> {
    const res = await this.f(path.startsWith('http') ? path : API + path, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const okExtra = opts.okStatus ?? [];
    if (!res.ok && !okExtra.includes(res.status)) {
      let msg = res.statusText;
      try { const j = await res.json(); msg = j.message ?? msg; if (j.errors) msg += ' ' + JSON.stringify(j.errors); } catch { /* not json */ }
      const hint = res.status === 401 ? ' — التوكن غير صالح' : res.status === 403 || res.status === 404 ? ' — تأكد من صلاحيات التوكن' : '';
      throw new GithubError(res.status, `GitHub ${res.status}: ${msg}${hint}`);
    }
    let data: any = null;
    if (res.status !== 204) { try { data = await res.json(); } catch { data = null; } }
    return { data, headers: res.headers, status: res.status };
  }

  async user(): Promise<{ login: string; scopes: string[] }> {
    const r = await this.req<{ login: string }>('GET', '/user');
    const scopes = (r.headers.get('x-oauth-scopes') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return { login: r.data.login, scopes };
  }

  async repoExists(owner: string, name: string): Promise<boolean> {
    const r = await this.req('GET', `/repos/${owner}/${name}`, undefined, { okStatus: [404] });
    return r.status !== 404;
  }

  async createRepo(name: string, opts: { private: boolean; description: string }): Promise<{ full_name: string; html_url: string; default_branch: string; owner: string }> {
    const r = await this.req<any>('POST', '/user/repos', { name, private: opts.private, description: opts.description.slice(0, 350), auto_init: true, has_issues: true });
    return { full_name: r.data.full_name, html_url: r.data.html_url, default_branch: r.data.default_branch ?? 'main', owner: r.data.owner.login };
  }

  async setTopics(owner: string, repo: string, topics: string[]): Promise<void> {
    await this.req('PUT', `/repos/${owner}/${repo}/topics`, { names: topics.map((t) => t.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50)).filter(Boolean).slice(0, 20) });
  }

  async setDescription(owner: string, repo: string, description: string, homepage?: string): Promise<void> {
    await this.req('PATCH', `/repos/${owner}/${repo}`, { description: description.slice(0, 350), ...(homepage ? { homepage } : {}) });
  }

  /** Commits all files in ONE commit using the Git Data API. Returns the new commit sha. */
  async pushFiles(owner: string, repo: string, branch: string, files: ProjectFile[], message: string): Promise<string> {
    const ref = await this.req<any>('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    const parentSha: string = ref.data.object.sha;
    const parent = await this.req<any>('GET', `/repos/${owner}/${repo}/git/commits/${parentSha}`);
    const entries: { path: string; mode: string; type: string; sha: string }[] = [];
    await pool(files, 4, async (file) => {
      const blob = await this.req<any>('POST', `/repos/${owner}/${repo}/git/blobs`, { content: b64(file.content), encoding: 'base64' });
      entries.push({ path: file.path, mode: file.path.endsWith('.sh') ? '100755' : '100644', type: 'blob', sha: blob.data.sha });
    });
    entries.sort((a, b) => a.path.localeCompare(b.path));
    // No base_tree: the new commit contains exactly these files (republish replaces the previous content).
    const tree = await this.req<any>('POST', `/repos/${owner}/${repo}/git/trees`, { tree: entries });
    const commit = await this.req<any>('POST', `/repos/${owner}/${repo}/git/commits`, { message, tree: tree.data.sha, parents: [parent.data.sha ?? parentSha] });
    await this.req('PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha: commit.data.sha, force: true });
    return commit.data.sha as string;
  }

  async enablePages(owner: string, repo: string): Promise<'enabled' | 'already' > {
    const r = await this.req('POST', `/repos/${owner}/${repo}/pages`, { build_type: 'workflow' }, { okStatus: [409, 422] });
    return r.status === 409 || r.status === 422 ? 'already' : 'enabled';
  }

  async pagesUrl(owner: string, repo: string): Promise<string | null> {
    const r = await this.req<any>('GET', `/repos/${owner}/${repo}/pages`, undefined, { okStatus: [404] });
    return r.status === 404 ? null : r.data?.html_url ?? null;
  }

  async runsForSha(owner: string, repo: string, sha: string): Promise<RunInfo[]> {
    const r = await this.req<any>('GET', `/repos/${owner}/${repo}/actions/runs?head_sha=${sha}&per_page=20`);
    return (r.data.workflow_runs ?? []).map((x: any) => ({ id: x.id, status: x.status, conclusion: x.conclusion, url: x.html_url }));
  }

  /** Polls the runs of a commit until all complete. Retries once on a failed run is left to the caller. */
  async waitForRuns(owner: string, repo: string, sha: string, opts: { timeoutMs?: number; intervalMs?: number; onTick?: (runs: RunInfo[]) => void } = {}): Promise<RunInfo[]> {
    const deadline = Date.now() + (opts.timeoutMs ?? 25 * 60_000);
    const interval = opts.intervalMs ?? 8000;
    let emptyTicks = 0;
    for (;;) {
      const runs = await this.runsForSha(owner, repo, sha);
      opts.onTick?.(runs);
      if (runs.length === 0) emptyTicks++;
      if (runs.length > 0 && runs.every((r) => r.status === 'completed')) return runs;
      if (emptyTicks > 12) return runs; // no workflow was triggered
      if (Date.now() > deadline) throw new GithubError(408, 'انتهت مهلة انتظار الـ workflow');
      await this.wait(interval);
    }
  }

  async rerunFailed(owner: string, repo: string, runId: number): Promise<void> {
    await this.req('POST', `/repos/${owner}/${repo}/actions/runs/${runId}/rerun-failed-jobs`);
  }

  async latestRelease(owner: string, repo: string): Promise<{ url: string; assets: { name: string; url: string }[] } | null> {
    const r = await this.req<any>('GET', `/repos/${owner}/${repo}/releases/latest`, undefined, { okStatus: [404] });
    if (r.status === 404) return null;
    return { url: r.data.html_url, assets: (r.data.assets ?? []).map((a: any) => ({ name: a.name, url: a.browser_download_url })) };
  }
}

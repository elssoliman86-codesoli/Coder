import { Skill, SkillCategory, SkillPermission, InstalledSkill, SkillExecutionResult } from '../types/skill';

const GITHUB_API_BASE = 'https://api.github.com';
const SKILLS_REGISTRY_OWNER = 'mukul975';
const SKILLS_REGISTRY_REPO = 'Anthropic-Cybersecurity-Skills';
const SKILLS_REGISTRY_PATH = '.github/ISSUE_TEMPLATE';

// Local storage keys
const INSTALLED_SKILLS_KEY = 'coder_installed_skills';
const SKILLS_CACHE_KEY = 'coder_skills_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Mock registry data (in production, this would come from GitHub API or a registry)
const MOCK_SKILLS_REGISTRY: Skill[] = [
  {
    id: 'skill-web-search',
    name: 'Web Search',
    version: '1.0.0',
    description: 'Search the public web using DuckDuckGo and return top results with titles, URLs, and snippets.',
    author: 'OneByte',
    category: 'utility',
    tags: ['search', 'web', 'duckduckgo', 'research'],
    manifest: {
      inputs: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          maxResults: { type: 'number', default: 10, description: 'Maximum number of results' }
        },
        required: ['query']
      },
      outputs: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                snippet: { type: 'string' }
              }
            }
          }
        }
      },
      tools: ['web_search'],
      permissions: ['net.http'],
      runSteps: ['Validate query', 'Call DuckDuckGo API', 'Parse and return results']
    },
    metadata: {
      downloads: 1250,
      rating: 4.8,
      verified: true,
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-06-20T00:00:00Z',
      repositoryUrl: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills',
      license: 'MIT'
    }
  },
  {
    id: 'skill-github-repos',
    name: 'GitHub Repositories',
    version: '1.1.0',
    description: 'List repositories accessible to the connected GitHub account. Use when the user asks to show/list their repos.',
    author: 'OneByte',
    category: 'development',
    tags: ['github', 'repositories', 'code', 'devops'],
    manifest: {
      inputs: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional case-insensitive name/description filter' }
        }
      },
      outputs: {
        type: 'object',
        properties: {
          repositories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                fullName: { type: 'string' },
                description: { type: 'string' },
                private: { type: 'boolean' },
                htmlUrl: { type: 'string' },
                language: { type: 'string' },
                stars: { type: 'number' },
                updatedAt: { type: 'string' }
              }
            }
          }
        }
      },
      tools: ['github_list_repositories'],
      permissions: ['net.http'],
      runSteps: ['Authenticate with GitHub', 'List repositories', 'Filter if query provided', 'Return results']
    },
    metadata: {
      downloads: 890,
      rating: 4.7,
      verified: true,
      createdAt: '2024-02-10T00:00:00Z',
      updatedAt: '2024-07-01T00:00:00Z',
      repositoryUrl: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills',
      license: 'MIT'
    }
  },
  {
    id: 'skill-github-read-file',
    name: 'GitHub Read File',
    version: '1.0.0',
    description: 'Read a text file from a GitHub repository before discussing or editing it. Returns content, branch, and revision SHA.',
    author: 'OneByte',
    category: 'development',
    tags: ['github', 'file', 'read', 'code-review'],
    manifest: {
      inputs: {
        type: 'object',
        properties: {
          repository: { type: 'string', description: 'Repository full name (owner/repo)' },
          path: { type: 'string', description: 'File path in repository' },
          branch: { type: 'string', description: 'Branch name (optional)' }
        },
        required: ['repository', 'path']
      },
      outputs: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          branch: { type: 'string' },
          sha: { type: 'string' }
        }
      },
      tools: ['github_read_file'],
      permissions: ['net.http'],
      runSteps: ['Validate repository and path', 'Fetch file content', 'Return content with metadata']
    },
    metadata: {
      downloads: 650,
      rating: 4.6,
      verified: true,
      createdAt: '2024-03-05T00:00:00Z',
      updatedAt: '2024-07-15T00:00:00Z',
      repositoryUrl: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills',
      license: 'MIT'
    }
  },
  {
    id: 'skill-github-update-file',
    name: 'GitHub Update File',
    version: '1.0.0',
    description: 'Replace the complete contents of an existing text file and create a GitHub commit.',
    author: 'OneByte',
    category: 'development',
    tags: ['github', 'file', 'update', 'commit', 'code-review'],
    manifest: {
      inputs: {
        type: 'object',
        properties: {
          repository: { type: 'string', description: 'Repository full name (owner/repo)' },
          path: { type: 'string', description: 'File path in repository' },
          content: { type: 'string', description: 'New file content' },
          message: { type: 'string', description: 'Commit message' },
          branch: { type: 'string', description: 'Branch name (optional)' },
          expectedSha: { type: 'string', description: 'Current file SHA for safe update' }
        },
        required: ['repository', 'path', 'content', 'message', 'expectedSha']
      },
      outputs: {
        type: 'object',
        properties: {
          commitUrl: { type: 'string' },
          newSha: { type: 'string' }
        }
      },
      tools: ['github_update_file'],
      permissions: ['net.http'],
      runSteps: ['Validate inputs', 'Update file with SHA check', 'Create commit', 'Return commit URL']
    },
    metadata: {
      downloads: 520,
      rating: 4.5,
      verified: true,
      createdAt: '2024-03-20T00:00:00Z',
      updatedAt: '2024-08-01T00:00:00Z',
      repositoryUrl: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills',
      license: 'MIT'
    }
  },
  {
    id: 'skill-web-fetch',
    name: 'Web Fetch',
    version: '1.0.0',
    description: 'Read a public web page the user asked about. Returns readable text or HTML source.',
    author: 'OneByte',
    category: 'utility',
    tags: ['web', 'fetch', 'scrape', 'html', 'research'],
    manifest: {
      inputs: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
          includeSource: { type: 'boolean', default: false, description: 'Return raw HTML/source' }
        },
        required: ['url']
      },
      outputs: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          url: { type: 'string' },
          status: { type: 'number' }
        }
      },
      tools: ['web_fetch'],
      permissions: ['net.http'],
      runSteps: ['Validate URL', 'Fetch page content', 'Extract text or return source', 'Return result']
    },
    metadata: {
      downloads: 2100,
      rating: 4.9,
      verified: true,
      createdAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-06-10T00:00:00Z',
      repositoryUrl: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills',
      license: 'MIT'
    }
  },
  {
    id: 'skill-analyze-dns-logs',
    name: 'Analyze DNS Logs for Exfiltration',
    version: '1.2.0',
    description: 'Analyzes DNS query logs to detect data exfiltration via DNS tunneling, suspicious domains, and anomalous query patterns.',
    author: 'OneByte',
    category: 'security',
    tags: ['dns', 'exfiltration', 'security', 'analysis', 'threat-hunting'],
    manifest: {
      inputs: {
        type: 'object',
        properties: {
          logs: { type: 'array', items: { type: 'string' }, description: 'DNS query log lines' },
          threshold: { type: 'number', default: 100, description: 'Queries per domain threshold' }
        },
        required: ['logs']
      },
      outputs: {
        type: 'object',
        properties: {
          suspiciousDomains: { type: 'array', items: { type: 'string' } },
          tunnelingIndicators: { type: 'array', items: { type: 'string' } },
          stats: { type: 'object' }
        }
      },
      tools: [],
      permissions: [],
      runSteps: ['Parse DNS logs', 'Count queries per domain', 'Detect high-entropy subdomains', 'Identify tunneling patterns', 'Return findings']
    },
    metadata: {
      downloads: 340,
      rating: 4.8,
      verified: true,
      createdAt: '2024-04-01T00:00:00Z',
      updatedAt: '2024-08-15T00:00:00Z',
      repositoryUrl: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills',
      license: 'MIT'
    }
  },
  {
    id: 'skill-analyze-apt-mitre',
    name: 'Analyze APT Group with MITRE Navigator',
    version: '1.0.0',
    description: 'Query ATT&CK data with attackcti, mitreattack-python, and stix2, then build MITRE ATT&CK Navigator layers.',
    author: 'OneByte',
    category: 'security',
    tags: ['apt', 'mitre', 'attack', 'threat-intel', 'navigator'],
    manifest: {
      inputs: {
        type: 'object',
        properties: {
          groupName: { type: 'string', description: 'APT group name or alias' },
          outputFormat: { type: 'string', enum: ['layer', 'json', 'markdown'], default: 'layer' }
        },
        required: ['groupName']
      },
      outputs: {
        type: 'object',
        properties: {
          layer: { type: 'object' },
          techniques: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' }
        }
      },
      tools: [],
      permissions: ['net.http'],
      runSteps: ['Query ATT&CK database', 'Find group techniques', 'Build navigator layer', 'Return layer JSON']
    },
    metadata: {
      downloads: 280,
      rating: 4.7,
      verified: true,
      createdAt: '2024-05-10T00:00:00Z',
      updatedAt: '2024-09-01T00:00:00Z',
      repositoryUrl: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills',
      license: 'MIT'
    }
  },
  {
    id: 'skill-abusing-dpapi',
    name: 'Abusing DPAPI for Credential Access',
    version: '1.0.0',
    description: 'Extract and decrypt Windows DPAPI-protected secrets (Credential Manager, browser logins/cookies, Wi-Fi credentials, KeePass).',
    author: 'OneByte',
    category: 'security',
    tags: ['dpapi', 'windows', 'credentials', 'forensics', 'decryption'],
    manifest: {
      inputs: {
        type: 'object',
        properties: {
          target: { type: 'string', enum: ['credman', 'browser', 'wifi', 'keepass', 'all'], default: 'all' },
          masterKey: { type: 'string', description: 'DPAPI master key (optional)' }
        }
      },
      outputs: {
        type: 'object',
        properties: {
          credentials: { type: 'array', items: { type: 'object' } },
          errors: { type: 'array', items: { type: 'string' } }
        }
      },
      tools: [],
      permissions: ['fs.read', 'shell.exec'],
      runSteps: ['Locate DPAPI blobs', 'Extract master keys', 'Decrypt credentials', 'Return structured results']
    },
    metadata: {
      downloads: 180,
      rating: 4.6,
      verified: true,
      createdAt: '2024-06-01T00:00:00Z',
      updatedAt: '2024-09-15T00:00:00Z',
      repositoryUrl: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills',
      license: 'MIT'
    }
  }
];

// Helper functions
function getInstalledSkills(): InstalledSkill[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(INSTALLED_SKILLS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setInstalledSkills(skills: InstalledSkill[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INSTALLED_SKILLS_KEY, JSON.stringify(skills));
}

function getCache(): { skills: Skill[]; timestamp: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(SKILLS_CACHE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setCache(skills: Skill[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SKILLS_CACHE_KEY, JSON.stringify({ skills, timestamp: Date.now() }));
}

function isCacheValid(): boolean {
  const cache = getCache();
  if (!cache) return false;
  return Date.now() - cache.timestamp < CACHE_TTL;
}

// API Functions
export async function searchSkills(query: string = '', category?: SkillCategory): Promise<Skill[]> {
  // Check cache first
  if (isCacheValid()) {
    const cache = getCache()!;
    let filtered = cache.skills;
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (category) {
      filtered = filtered.filter(s => s.category === category);
    }
    return filtered;
  }

  // In production, fetch from GitHub API or registry
  // For now, use mock data
  setCache(MOCK_SKILLS_REGISTRY);
  
  let filtered = MOCK_SKILLS_REGISTRY;
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    );
  }
  if (category) {
    filtered = filtered.filter(s => s.category === category);
  }
  return filtered;
}

export async function getSkillById(id: string): Promise<Skill | null> {
  const skills = await searchSkills('');
  return skills.find(s => s.id === id) || null;
}

export async function getCategories(): Promise<{ id: SkillCategory; name: string; count: number }[]> {
  const skills = await searchSkills('');
  const categories: SkillCategory[] = [
    'security', 'development', 'analysis', 'automation', 
    'testing', 'documentation', 'deployment', 'utility'
  ];
  
  return categories.map(cat => ({
    id: cat,
    name: cat.charAt(0).toUpperCase() + cat.slice(1),
    count: skills.filter(s => s.category === cat).length
  })).filter(c => c.count > 0);
}

export async function installSkill(skillId: string): Promise<InstalledSkill> {
  const skill = await getSkillById(skillId);
  if (!skill) throw new Error(`Skill not found: ${skillId}`);

  const installed = getInstalledSkills();
  if (installed.some(s => s.skillId === skillId)) {
    throw new Error('Skill already installed');
  }

  const newInstalled: InstalledSkill = {
    skillId,
    installedAt: new Date().toISOString(),
    enabled: true,
    settings: {},
    lastUsed: null
  };

  setInstalledSkills([...installed, newInstalled]);
  return newInstalled;
}

export async function uninstallSkill(skillId: string): Promise<void> {
  const installed = getInstalledSkills();
  const filtered = installed.filter(s => s.skillId !== skillId);
  if (filtered.length === installed.length) {
    throw new Error('Skill not installed');
  }
  setInstalledSkills(filtered);
}

export async function toggleSkillEnabled(skillId: string, enabled: boolean): Promise<void> {
  const installed = getInstalledSkills();
  const index = installed.findIndex(s => s.skillId === skillId);
  if (index === -1) throw new Error('Skill not installed');
  
  installed[index] = { ...installed[index], enabled };
  setInstalledSkills(installed);
}

export async function updateSkillSettings(skillId: string, settings: Record<string, unknown>): Promise<void> {
  const installed = getInstalledSkills();
  const index = installed.findIndex(s => s.skillId === skillId);
  if (index === -1) throw new Error('Skill not installed');
  
  installed[index] = { ...installed[index], settings: { ...installed[index].settings, ...settings } };
  setInstalledSkills(installed);
}

export async function recordSkillUsage(skillId: string): Promise<void> {
  const installed = getInstalledSkills();
  const index = installed.findIndex(s => s.skillId === skillId);
  if (index === -1) return;
  
  installed[index] = { ...installed[index], lastUsed: new Date().toISOString() };
  setInstalledSkills(installed);
}

export async function getInstalledSkillsList(): Promise<InstalledSkill[]> {
  return getInstalledSkills();
}

export async function getInstalledSkillDetails(): Promise<(InstalledSkill & { skill: Skill })[]> {
  const installed = getInstalledSkills();
  const skills = await searchSkills('');
  
  return installed.map(inst => {
    const skill = skills.find(s => s.id === inst.skillId);
    return { ...inst, skill: skill! };
  }).filter(inst => inst.skill);
}

export async function checkForUpdates(): Promise<{ skillId: string; currentVersion: string; latestVersion: string }[]> {
  const installed = getInstalledSkills();
  const skills = await searchSkills('');
  
  return installed
    .map(inst => {
      const skill = skills.find(s => s.id === inst.skillId);
      if (!skill) return null;
      // Simple version comparison (in production, use semver)
      if (skill.version !== '1.0.0') { // Mock: pretend there's an update
        return { skillId: inst.skillId, currentVersion: '1.0.0', latestVersion: skill.version };
      }
      return null;
    })
    .filter(Boolean) as { skillId: string; currentVersion: string; latestVersion: string }[];
}

export async function executeSkill(skillId: string, inputs: Record<string, unknown>): Promise<SkillExecutionResult> {
  const startTime = Date.now();
  const installed = getInstalledSkills();
  const inst = installed.find(s => s.skillId === skillId);
  
  if (!inst || !inst.enabled) {
    return {
      success: false,
      error: 'Skill not installed or disabled',
      duration: Date.now() - startTime
    };
  }

  const skill = await getSkillById(skillId);
  if (!skill) {
    return {
      success: false,
      error: 'Skill definition not found',
      duration: Date.now() - startTime
    };
  }

  // Validate inputs against manifest schema (simplified)
  const requiredInputs = skill.manifest.inputs.required || [];
  for (const req of requiredInputs) {
    if (!(req in inputs)) {
      return {
        success: false,
        error: `Missing required input: ${req}`,
        duration: Date.now() - startTime
      };
    }
  }

  // Record usage
  await recordSkillUsage(skillId);

  // In production, this would invoke the actual skill runner
  // For now, return mock success
  return {
    success: true,
    output: { message: `Skill ${skill.name} executed successfully (mock)`, inputs },
    duration: Date.now() - startTime,
    logs: ['Skill started', 'Inputs validated', 'Execution completed']
  };
}

export function getRequiredPermissions(skill: Skill): SkillPermission[] {
  return skill.manifest.permissions || [];
}

export function hasPermission(permissions: SkillPermission[], required: SkillPermission): boolean {
  return permissions.includes(required);
}
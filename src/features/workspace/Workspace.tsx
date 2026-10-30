import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, FileCode2, Save, Plus, FolderOpen, Check, LoaderCircle, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { useStore, useSettings } from '@app/store';
import { Button } from '@components/ui/button';
import { getLanguageFromPath } from '@lib/utils';
import { generateProjectFiles, resolveActiveModel } from '@lib/ai/client';
import { CodeEditor } from './CodeEditor';

function normalizeWorkspacePath(value: string): string | null {
  const path = value.trim().replace(/\\/g, '/');
  if (!path || path.length > 240 || path.startsWith('/') || /^[a-z]:/i.test(path)) return null;
  const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
  const invalidCharacters = /[<>:"|?*\u0000-\u001f]/;
  const parts = path.split('/');
  if (parts.some(part =>
    !part || part === '.' || part === '..' ||
    part.toLowerCase() === '.git' ||
    part.toLowerCase() === 'node_modules' ||
    /^\.env(?:\.|$)/i.test(part) ||
    invalidCharacters.test(part) ||
    /[. ]$/.test(part) ||
    reservedNames.test(part)
  )) return null;
  return path;
}

export function Workspace() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const project = useStore(state => state.projects[projectId]);
  const updateProject = useStore(state => state.updateProject);
  const setCurrentProject = useStore(state => state.setCurrentProject);
  const settings = useSettings();
  const [path, setPath] = useState('');
  const [content, setContent] = useState('');
  const [newPath, setNewPath] = useState('');
  const [fileError, setFileError] = useState('');
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dirty, setDirty] = useState(false);
  const files = useMemo(() => project?.files ?? [], [project?.files]);
  const isGenerating = project?.generationStatus === 'running';

  const saveFile = useCallback((filePath = path, fileContent = content) => {
    if (!projectId || !filePath) return;
    const current = useStore.getState().projects[projectId];
    if (!current) return;

    const nextFile = {
      path: filePath,
      content: fileContent,
      language: getLanguageFromPath(filePath),
      size: new Blob([fileContent]).size,
      modified: true,
      lastModified: Date.now()
    };
    const next = [...(current.files ?? []).filter(file => file.path !== filePath), nextFile]
      .sort((a, b) => a.path.localeCompare(b.path));
    updateProject(projectId, { files: next, updatedAt: Date.now() });
    if (filePath === path) setDirty(false);
  }, [projectId, path, content, updateProject]);

  useEffect(() => {
    const current = useStore.getState().projects[projectId];
    if (!current) return;
    setCurrentProject(current.id);
    const first = current.files?.find(file => file.path !== 'README.md') ?? current.files?.[0];
    if (first) {
      setPath(first.path);
      setContent(first.content ?? '');
    } else {
      setPath('README.md');
      setContent('# ' + current.name + '\n\nابدأ كتابة ملفات مشروعك هنا.');
    }
    setDirty(false);
  }, [projectId, setCurrentProject]);

  useEffect(() => {
    if (!settings.autoSave || !dirty || !path || !project || isGenerating) return;
    const timeout = window.setTimeout(() => saveFile(path, content), 700);
    return () => window.clearTimeout(timeout);
  }, [settings.autoSave, dirty, path, content, project?.id, isGenerating, saveFile]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveFile]);

  useEffect(() => {
    if (!project || dirty || project.generationStatus !== 'complete') return;
    const firstSource = project.files.find(file => file.path !== 'README.md');
    if (firstSource && path === 'README.md') {
      setPath(firstSource.path);
      setContent(firstSource.content ?? '');
    }
  }, [project?.generationStatus, project?.files, dirty, path]);

  const openFile = (nextPath: string, nextContent: string) => {
    if (dirty) saveFile(path, content);
    setPath(nextPath);
    setContent(nextContent);
    setDirty(false);
  };

  const retryGeneration = async () => {
    if (isGenerating || !project) return;
    const active = resolveActiveModel();
    if (!active) {
      updateProject(projectId, {
        generationStatus: 'error',
        generationError: 'لا يوجد مزود وموديل جاهز بمفتاح صالح. راجع إعدادات الموديل أولاً.'
      });
      return;
    }

    if (dirty) saveFile(path, content);
    const snapshot = useStore.getState().projects[projectId];
    if (!snapshot) return;

    const preserveExistingFiles = Boolean(snapshot.generationSummary || snapshot.importedFrom || snapshot.generationStatus === 'complete');
    updateProject(projectId, { generationStatus: 'running', generationError: undefined });
    try {
      const result = await generateProjectFiles(snapshot, active.provider, active.model);
      const latest = useStore.getState().projects[projectId];
      if (!latest) return;

      const merged = new Map(result.files.map(file => [file.path, file]));
      for (const file of latest.files ?? []) {
        if (file.modified || preserveExistingFiles) merged.set(file.path, file);
      }
      updateProject(projectId, {
        files: [...merged.values()].sort((a, b) => a.path.localeCompare(b.path)),
        generationStatus: 'complete',
        generationSummary: result.summary,
        generationError: undefined,
        updatedAt: Date.now()
      });
    } catch (cause) {
      updateProject(projectId, {
        generationStatus: 'error',
        generationError: cause instanceof Error ? cause.message : 'تعذر توليد الملفات.'
      });
    }
  };

  const createFile = () => {
    const clean = normalizeWorkspacePath(newPath);
    if (!clean) {
      setFileError('مسار الملف غير صالح أو يحتوي على اسم محظور.');
      return;
    }
    setFileError('');

    const current = useStore.getState().projects[projectId];
    if (!current) return;
    const existing = current.files ?? [];
    const match = existing.find(file => file.path.toLowerCase() === clean.toLowerCase());
    if (match) {
      if (dirty) saveFile(path, content);
      const latest = useStore.getState().projects[projectId];
      const latestMatch = latest?.files?.find(file => file.path === match.path) ?? match;
      setPath(latestMatch.path);
      setContent(latestMatch.content ?? '');
      setDirty(false);
      setNewPath('');
      return;
    }

    if (dirty) saveFile(path, content);
    const latest = useStore.getState().projects[projectId];
    const latestFiles = latest?.files ?? existing;
    const now = Date.now();
    const file = {
      path: clean,
      content: '',
      language: getLanguageFromPath(clean),
      size: 0,
      modified: true,
      lastModified: now
    };
    updateProject(projectId, {
      files: [...latestFiles, file].sort((a, b) => a.path.localeCompare(b.path)),
      updatedAt: now
    });
    setPath(clean);
    setContent('');
    setDirty(false);
    setNewPath('');
  };

  const beginRename = (filePath: string) => {
    setRenameTarget(filePath);
    setRenameValue(filePath);
    setFileError('');
  };

  const commitRename = () => {
    if (!renameTarget) return;
    const clean = normalizeWorkspacePath(renameValue);
    if (!clean) {
      setFileError('اسم الملف الجديد غير صالح.');
      return;
    }

    const current = useStore.getState().projects[projectId];
    if (!current) return;
    const duplicate = (current.files ?? []).some(file =>
      file.path.toLowerCase() === clean.toLowerCase() && file.path !== renameTarget
    );
    if (duplicate) {
      setFileError('يوجد ملف آخر بنفس المسار.');
      return;
    }

    if (dirty) saveFile(path, content);
    const latest = useStore.getState().projects[projectId];
    if (!latest) return;
    const target = latest.files.find(file => file.path === renameTarget);
    if (!target) {
      setFileError('الملف لم يعد موجودًا.');
      return;
    }

    const renamed = {
      ...target,
      path: clean,
      language: getLanguageFromPath(clean),
      modified: true,
      lastModified: Date.now()
    };
    updateProject(projectId, {
      files: latest.files.map(file => file.path === renameTarget ? renamed : file),
      updatedAt: Date.now()
    });
    if (path === renameTarget) setPath(clean);
    setRenameTarget(null);
    setRenameValue('');
    setFileError('');
  };

  const deleteFile = (filePath: string) => {
    if (!window.confirm('حذف الملف ' + filePath + '؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    if (dirty && path !== filePath) saveFile(path, content);

    const latest = useStore.getState().projects[projectId];
    if (!latest) return;
    let remaining = latest.files.filter(file => file.path !== filePath);
    if (!remaining.length) {
      const readme = '# ' + latest.name + '\n\nابدأ كتابة ملفات مشروعك هنا.';
      remaining = [{
        path: 'README.md',
        content: readme,
        language: 'markdown',
        size: new Blob([readme]).size,
        modified: true,
        lastModified: Date.now()
      }];
    }
    updateProject(projectId, { files: remaining, updatedAt: Date.now() });
    if (path === filePath) {
      const next = remaining[0];
      setPath(next.path);
      setContent(next.content ?? '');
      setDirty(false);
    }
    if (renameTarget === filePath) setRenameTarget(null);
  };

  if (!project) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <p>المشروع غير موجود أو لم يتم تحميل بياناته.</p>
        <Button onClick={() => navigate('/')}>العودة للمشاريع</Button>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={() => navigate('/')} className="mb-2 flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <ArrowRight size={16}/> المشاريع
          </button>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.description || 'مساحة عمل المشروع'}</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty
            ? <span className="text-xs text-amber-500">تعديلات غير محفوظة</span>
            : <span className="flex items-center gap-1 text-xs text-emerald-500"><Check size={14}/> محفوظ</span>}
          <Button onClick={() => saveFile()} disabled={!dirty}><Save size={16}/> حفظ الملف</Button>
        </div>
      </div>

      {isGenerating && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <LoaderCircle className="animate-spin text-primary" size={18}/>
          <div><p className="font-medium">الذكاء الاصطناعي بيحلل المشروع وبيجهز الملفات</p><p className="text-xs text-muted-foreground">تم تعطيل التحرير مؤقتًا لحماية التعديلات أثناء التوليد.</p></div>
        </div>
      )}
      {project.generationStatus === 'error' && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 shrink-0 text-destructive" size={18}/>
          <div>
            <p className="font-medium">تعذر توليد ملفات المشروع</p>
            <p className="mt-1 text-muted-foreground">{project.generationError || 'حدث خطأ غير معروف.'}</p>
            <Button className="mt-3" variant="outline" size="sm" loading={isGenerating} onClick={() => void retryGeneration()}>إعادة محاولة التوليد</Button>
          </div>
        </div>
      )}
      {project.generationStatus === 'complete' && project.generationSummary && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
          <p className="mb-1 font-semibold">ملخص تحليل المشروع</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{project.generationSummary}</p>
        </div>
      )}
      {(!project.generationStatus || project.generationStatus === 'idle') && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border p-4 text-sm">
          <p className="text-muted-foreground">المشروع محفوظ محليًا. يمكنك ربط موديل الآن وبدء التحليل دون إعادة إنشاء المشروع.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void retryGeneration()}>ابدأ تحليل المشروع</Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/settings')}>إعدادات الموديل</Button>
          </div>
        </div>
      )}

      <div className="grid min-h-[68vh] overflow-hidden rounded-2xl border border-border lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-border bg-card p-3 lg:border-b-0 lg:border-l">
          <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-muted-foreground">ملفات المشروع</p><FolderOpen size={15}/></div>
          {fileError && <p role="alert" className="mb-2 text-xs text-destructive">{fileError}</p>}
          <div className="mb-3 flex gap-2">
            <input
              aria-label="مسار الملف الجديد"
              className="input-field min-w-0"
              value={newPath}
              onChange={event => { setNewPath(event.target.value); setFileError(''); }}
              onKeyDown={event => { if (event.key === 'Enter') createFile(); }}
              placeholder="src/index.ts"
              disabled={isGenerating}
            />
            <Button size="icon" onClick={createFile} disabled={!newPath.trim() || isGenerating} aria-label="إنشاء ملف"><Plus size={16}/></Button>
          </div>
          {renameTarget && (
            <div className="mb-3 space-y-2 rounded-lg border border-primary/30 bg-background p-2">
              <label className="block text-xs text-muted-foreground" htmlFor="rename-file-path">المسار الجديد</label>
              <input id="rename-file-path" className="input-field" value={renameValue} onChange={event => setRenameValue(event.target.value)} disabled={isGenerating}/>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={commitRename} disabled={isGenerating}>حفظ الاسم</Button>
                <Button size="sm" variant="outline" onClick={() => { setRenameTarget(null); setFileError(''); }}>إلغاء</Button>
              </div>
            </div>
          )}
          <div className="max-h-[55vh] space-y-1 overflow-auto">
            {files.map(file => (
              <div key={file.path} className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => openFile(file.path, file.content ?? '')}
                  disabled={isGenerating}
                  aria-current={path === file.path ? 'page' : undefined}
                  className={'flex min-h-11 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg px-2 py-2 text-right text-sm disabled:opacity-50 ' + (path === file.path ? 'bg-primary/10 text-primary' : 'hover:bg-accent')}
                >
                  <FileCode2 size={15} className="shrink-0"/><span className="truncate">{file.path}</span>
                </button>
                <Button size="icon" variant="ghost" aria-label={'إعادة تسمية ' + file.path} title="إعادة تسمية" disabled={isGenerating} onClick={() => beginRename(file.path)}><Pencil size={14}/></Button>
                <Button size="icon" variant="ghost" aria-label={'حذف ' + file.path} title="حذف الملف" disabled={isGenerating} onClick={() => deleteFile(file.path)}><Trash2 size={14}/></Button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{files.length} ملف محفوظ</p>
        </aside>
        <div className="flex min-h-[55vh] flex-col bg-[#0b1120]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 font-mono text-xs text-slate-300" dir="ltr">
            <span>{path || 'اختر ملفًا'}</span><span>{getLanguageFromPath(path || '')}</span>
          </div>
          <div className={'min-h-[55vh] flex-1 ' + (isGenerating ? 'pointer-events-none opacity-60' : '')}>
            <CodeEditor value={content} language={getLanguageFromPath(path || '')} fontSize={settings.fontSize} tabSize={settings.editorTabSize} wordWrap={settings.wordWrap} readOnly={isGenerating} onChange={value => { setContent(value); setDirty(true); }}/>
          </div>
        </div>
      </div>
    </section>
  );
}

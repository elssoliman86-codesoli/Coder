import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, X, Plus, FolderOpen, FileText,
  Terminal, Bot, Settings, Save, MoreVertical, Search,
  ArrowLeft, ArrowRight, Maximize2, Minimize2, Copy, Check,
  AlertCircle, Loader2, FolderClosed, FolderOpen as FolderOpenIcon,
  GitBranch, Play, Pause, Square, RotateCcw
} from 'lucide-react';
import { EditorView } from '@codemirror/view';
import { EditorState, Compartment, Extension } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { less } from '@codemirror/lang-less';
import { sass } from '@codemirror/lang-sass';
import { xml } from '@codemirror/lang-xml';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection } from '@codemirror/view';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { useStore } from '@app/store';
import { cn, getLanguageFromPath, getLanguageConfig } from '@lib/utils';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Card } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@components/ui/tooltip';

interface Tab {
  id: string;
  filePath: string;
  label: string;
  modified: boolean;
  language: string;
}

const LANGUAGE_EXTENSIONS: Record<string, Extension> = {
  javascript: javascript(),
  typescript: javascript({ jsx: true, typescript: true }),
  jsx: javascript({ jsx: true }),
  tsx: javascript({ jsx: true, typescript: true }),
  python: python(),
  rust: rust(),
  go: go(),
  cpp: cpp(),
  c: cpp(),
  h: cpp(),
  hpp: cpp(),
  java: java(),
  php: php(),
  html: html(),
  css: css(),
  scss: sass(),
  sass: sass(),
  less: less(),
  json: json(),
  xml: xml(),
  markdown: markdown(),
  sql: sql(),
  shell: javascript(),
  bash: javascript(),
  sh: javascript(),
  yaml: javascript(),
  yml: javascript(),
  dockerfile: javascript(),
  gitignore: javascript(),
  plaintext: [],
};

export function Workspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, updateProject, setCurrentProject, currentProjectId } = useStore();
  
  const project = projectId ? projects[projectId] : null;
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanel, setRightPanel] = useState<'agent' | 'terminal' | 'problems' | null>('agent');
  const [rightPanelWidth, setRightPanelWidth] = useState(380);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'terminal' | 'problems' | 'output'>('terminal');
  const [fileTreeSearch, setFileTreeSearch] = useState('');
  const [editorViews, setEditorViews] = useState<Map<string, EditorView>>(new Map());
  const [agentMessages, setAgentMessages] = useState<Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }>>([]);
  const [agentInput, setAgentInput] = useState('');
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('مرحباً بك في الطرفية\n$ ');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [terminalHistoryIndex, setTerminalHistoryIndex] = useState(-1);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileTreeRef = useRef<HTMLDivElement>(null);

  // Initialize workspace
  useEffect(() => {
    if (projectId && project) {
      setCurrentProject(projectId);
      // Open first file if no tabs
      if (tabs.length === 0 && project.files.length > 0) {
        openFile(project.files[0].path);
      }
    } else if (projectId && !project) {
      navigate('/');
    }
  }, [projectId, project, navigate, setCurrentProject, tabs.length]);

  // Sync tabs with project files
  useEffect(() => {
    if (project && tabs.length === 0 && project.files.length > 0) {
      const initialTabs: Tab[] = project.files.slice(0, 5).map(f => ({
        id: f.path,
        filePath: f.path,
        label: f.path.split('/').pop() || f.path,
        modified: f.modified,
        language: getLanguageFromPath(f.path),
      }));
      setTabs(initialTabs);
      setActiveTabId(initialTabs[0].id);
    }
  }, [project, tabs.length]);

  const getLanguageExtension = (language: string): Extension => {
    return LANGUAGE_EXTENSIONS[language] || [];
  };

  const createEditorView = useCallback((filePath: string, content: string, language: string) => {
    const extensions = [
      basicSetup,
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      bracketMatching(),
      foldGutter(),
      drawSelection(),
      indentOnInput(),
      syntaxHighlighting(oneDark),
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...completionKeymap,
        ...lintKeymap,
      ]),
      autocompletion(),
      getLanguageExtension(language),
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          fontSize: '14px',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          height: '100%',
        },
        '.cm-content': {
          padding: '12px',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--background)',
          borderRight: '1px solid var(--border)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--accent)',
        },
      }),
    ];

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    return new EditorView({ state, parent: editorRef.current! });
  }, []);

  const openFile = (filePath: string) => {
    if (!project) return;
    
    const file = project.files.find(f => f.path === filePath);
    if (!file) return;

    const existingTab = tabs.find(t => t.filePath === filePath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const newTab: Tab = {
      id: filePath,
      filePath,
      label: filePath.split('/').pop() || filePath,
      modified: file.modified,
      language: getLanguageFromPath(filePath),
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        const idx = prev.findIndex(t => t.id === tabId);
        const nextTab = newTabs[idx] || newTabs[idx - 1] || null;
        setActiveTabId(nextTab?.id || null);
      }
      return newTabs;
    });
  };

  const saveFile = (tabId: string) => {
    if (!project) return;
    
    const tab = tabs.find(t => t.id === tabId);
    const view = editorViews.get(tabId);
    if (!tab || !view) return;

    const content = view.state.doc.toString();
    
    updateProject(project.id, {
      files: project.files.map(f => 
        f.path === tab.filePath 
          ? { ...f, content, modified: false, lastModified: Date.now(), size: new Blob([content]).size }
          : f
      ),
      updatedAt: Date.now(),
    });

    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, modified: false } : t));
  };

  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleEditorMount = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    const file = project?.files.find(f => f.path === tab?.filePath);
    if (!tab || !file || editorViews.has(tabId)) return;

    const view = createEditorView(tab.filePath, file.content, tab.language);
    
    // Listen for changes
    view.dispatch({
      effects: EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          setTabs(prev => prev.map(t => t.id === tabId ? { ...t, modified: true } : t));
        }
      })
    });

    setEditorViews(prev => new Map(prev).set(tabId, view));
  };

  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeFile = activeTab ? project?.files.find(f => f.path === activeTab.filePath) : null;

  // File tree helpers
  const buildFileTree = (files: ProjectFile[]): FileTreeNode[] => {
    const root: Record<string, FileTreeNode> = {};
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = root;
      let currentPath = '';
      
      parts.forEach((part, i) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = i === parts.length - 1;
        
        if (!current[part]) {
          current[part] = {
            name: part,
            type: isFile ? 'file' : 'directory',
            path: currentPath,
            children: isFile ? undefined : {},
            purpose: isFile ? file.language : '',
            language: isFile ? getLanguageFromPath(part) : undefined,
          };
        }
        if (!isFile) {
          current = current[part].children as Record<string, FileTreeNode>;
        }
      });
    });

    const convert = (nodes: Record<string, FileTreeNode>): FileTreeNode[] => 
      Object.values(nodes).map(n => ({
        ...n,
        children: n.children ? convert(n.children) : undefined,
      })).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return convert(root);
  };

  const filteredFiles = project?.files.filter(f => 
    f.path.toLowerCase().includes(fileTreeSearch.toLowerCase())
  ) || [];

  const fileTree = buildFileTree(filteredFiles);

  const renderFileTree = (nodes: FileTreeNode[], level = 0): React.ReactNode => (
    <div role="tree" aria-label="ملفات المشروع">
      {nodes.map(node => (
        <div key={node.path} style={{ paddingLeft: `${level * 16 + 8}px` }}>
          {node.type === 'directory' ? (
            <FileTreeFolder node={node} level={level} onClick={() => openFile(node.path)} />
          ) : (
            <FileTreeFile node={node} isActive={activeTab?.filePath === node.path} onClick={() => openFile(node.path)} />
          ))}
      )}
    </div>
  );

  // Agent functions
  const handleAgentSend = async () => {
    if (!agentInput.trim() || !project || isAgentRunning) return;
    
    const userMessage = { role: 'user' as const, content: agentInput, timestamp: Date.now() };
    setAgentMessages(prev => [...prev, userMessage]);
    const prompt = agentInput;
    setAgentInput('');
    setIsAgentRunning(true);

    try {
      // This would integrate with the actual agent
      // For now, simulate a response
      await new Promise(r => setTimeout(r, 1000));
      
      const response = `فهمت طلبك: "${prompt}". سأقوم بتحليل المشروع وتنفيذ التغييرات المطلوبة.`;
      setAgentMessages(prev => [...prev, { role: 'assistant' as const, content: response, timestamp: Date.now() }]);
    } catch (error) {
      setAgentMessages(prev => [...prev, { role: 'system' as const, content: 'خطأ في الاتصال بالوكيل', timestamp: Date.now() }]);
    } finally {
      setIsAgentRunning(false);
    }
  };

  const handleTerminalSubmit = () => {
    if (!terminalInput.trim()) return;
    
    const command = terminalInput;
    setTerminalOutput(prev => prev + command + '\n');
    setTerminalHistory(prev => [...prev, command]);
    setTerminalHistoryIndex(-1);
    setTerminalInput('');
    
    // Simulate command output
    setTimeout(() => {
      setTerminalOutput(prev => prev + `تم تنفيذ: ${command}\n$ `);
    }, 100);
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalHistoryIndex < terminalHistory.length - 1) {
        setTerminalHistoryIndex(prev => prev + 1);
        setTerminalInput(terminalHistory[terminalHistory.length - 1 - terminalHistoryIndex - 1] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (terminalHistoryIndex > 0) {
        setTerminalHistoryIndex(prev => prev - 1);
        setTerminalInput(terminalHistory[terminalHistory.length - 1 - terminalHistoryIndex + 1] || '');
      } else {
        setTerminalHistoryIndex(-1);
        setTerminalInput('');
      }
    } else if (e.key === 'Enter') {
      handleTerminalSubmit();
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full font-arabic">
        <div className="text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold">المشروع غير موجود</h2>
          <p className="text-muted-foreground mt-2">سيتم توجيهك للصفحة الرئيسية</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-background font-arabic">
      {/* Left Sidebar - File Tree */}
      <aside className={cn(
        'flex flex-col bg-card border-r border-border transition-all duration-200',
        sidebarOpen ? 'w-72' : 'w-12'
      )}>
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          {sidebarOpen && (
            <h3 className="font-semibold text-sm">ملفات المشروع</h3>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-muted-foreground hover:text-foreground"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {sidebarOpen && (
          <>
            <div className="p-2">
              <Input
                placeholder="بحث في الملفات..."
                value={fileTreeSearch}
                onChange={e => setFileTreeSearch(e.target.value)}
                className="text-sm font-arabic"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2" ref={fileTreeRef}>
              {renderFileTree(fileTree)}
            </div>
          </>
        )}
      </aside>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex-1 flex gap-0.5 min-w-0 overflow-x-auto" role="tablist">
            {tabs.map(tab => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={activeTabId === tab.id}
                onClick={() => handleTabChange(tab.id)}
                onClose={() => closeTab(tab.id)}
                onSave={() => saveFile(tab.id)}
              />
            ))}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {}}
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
              aria-label="فتح ملف"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="حفظ الكل">
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="تشغيل">
              <Play className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex min-h-0 relative">
          {activeTab && activeFile && editorRef.current ? (
            <div 
              ref={editorRef} 
              className="flex-1 min-w-0"
              onMouseEnter={() => handleEditorMount(activeTab.id)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground font-arabic">
              لا يوجد ملف مفتوح. انقر على ملف في الشجرة الجانبية لفتحه.
            </div>
          )}

          {/* Right Panel Resizer */}
          {rightPanel && (
            <div
              className="w-1 bg-border hover:bg-primary cursor-col-resize flex items-center justify-center"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = rightPanelWidth;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const newWidth = startWidth + (startX - moveEvent.clientX);
                  setRightPanelWidth(Math.max(250, Math.min(600, newWidth)));
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <div className="w-px h-8 bg-border/50" />
            </div>
          )}

          {/* Right Panel */}
          {rightPanel && (
            <aside className={cn(
              'flex flex-col bg-card border-l border-border transition-all duration-200 overflow-hidden',
              'min-h-0'
            )} style={{ width: rightPanelWidth }}>
              <div className="flex items-center justify-between p-2 border-b border-border/50">
                <Tabs value={rightPanel} onValueChange={setRightPanel} className="flex-1">
                  <TabsList className="grid w-full grid-cols-3 bg-transparent p-0">
                    <TabsTrigger value="agent" className="text-xs py-1.5"><Bot className="h-3.5 w-3.5 mx-auto" /></TabsTrigger>
                    <TabsTrigger value="terminal" className="text-xs py-1.5"><Terminal className="h-3.5 w-3.5 mx-auto" /></TabsTrigger>
                    <TabsTrigger value="problems" className="text-xs py-1.5"><AlertCircle className="h-3.5 w-3.5 mx-auto" /></TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button variant="ghost" size="icon" onClick={() => setRightPanel(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                {rightPanel === 'agent' && <AgentPanel messages={agentMessages} input={agentInput} onInputChange={setAgentInput} onSend={handleAgentSend} isRunning={isAgentRunning} project={project} />}
                {rightPanel === 'terminal' && <TerminalPanel output={terminalOutput} input={terminalInput} onInputChange={setTerminalInput} onKeyDown={handleTerminalKeyDown} />}
                {rightPanel === 'problems' && <ProblemsPanel />}
              </div>
            </aside>
          )}

          {/* Bottom Panel Resizer */}
          {showBottomPanel && (
            <div
              className="h-1 bg-border hover:bg-primary cursor-row-resize flex items-center justify-center w-full"
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startHeight = bottomPanelHeight;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const newHeight = startHeight + (startY - moveEvent.clientY);
                  setBottomPanelHeight(Math.max(100, Math.min(500, newHeight)));
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <div className="h-px w-24 bg-border/50" />
            </div>
          )}

          {/* Bottom Panel */}
          {showBottomPanel && (
            <div className="flex flex-col bg-card border-t border-border" style={{ height: bottomPanelHeight }}>
              <div className="flex items-center justify-between p-2 border-b border-border/50">
                <Tabs value={activeBottomTab} onValueChange={setActiveBottomTab} className="flex-1">
                  <TabsList className="grid w-full grid-cols-3 bg-transparent p-0">
                    <TabsTrigger value="terminal" className="text-xs py-1.5 font-arabic">الطرفية</TabsTrigger>
                    <TabsTrigger value="problems" className="text-xs py-1.5 font-arabic">المشاكل</TabsTrigger>
                    <TabsTrigger value="output" className="text-xs py-1.5 font-arabic">المخرجات</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button variant="ghost" size="icon" onClick={() => setShowBottomPanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                {activeBottomTab === 'terminal' && <TerminalPanel output={terminalOutput} input={terminalInput} onInputChange={setTerminalInput} onKeyDown={handleTerminalKeyDown} />}
                {activeBottomTab === 'problems' && <ProblemsPanel />}
                {activeBottomTab === 'output' && <OutputPanel />}
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-card border-t border-border/50 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-3">
            <span>{activeTab?.language || 'plaintext'}</span>
            <span>UTF-8</span>
            <span>LF</span>
            {activeTab?.modified && <span className="text-orange-400">●</span>}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setShowBottomPanel(!showBottomPanel)}>
              {showBottomPanel ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setRightPanel(rightPanel ? null : 'agent')}>
              <Bot className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setRightPanel(rightPanel === 'terminal' ? null : 'terminal')}>
              <Terminal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components
interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
  onSave: () => void;
}

function TabItem({ tab, isActive, onClick, onClose, onSave }: TabItemProps) {
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-sm font-medium transition-all min-w-0 max-w-[200px]',
        isActive
          ? 'bg-background text-foreground border-b-2 border-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      )}
    >
      <span className="truncate font-arabic">{tab.label}</span>
      {tab.modified && <span className="text-orange-400">●</span>}
      <Button variant="ghost" size="icon" className="h-5 w-5 p-0 opacity-0 hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onClose(); }}>
        <X className="h-3 w-3" />
      </Button>
    </button>
  );
}

interface FileTreeFolderProps {
  node: { name: string; path: string; children?: any[] };
  level: number;
  onClick: () => void;
}

function FileTreeFolder({ node, level, onClick }: FileTreeFolderProps) {
  const [open, setOpen] = useState(level < 2);
  
  return (
    <div>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent text-sm text-muted-foreground font-arabic"
        aria-expanded={open}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        <FolderClosed className="h-3.5 w-3.5" />
        <span className="truncate">{node.name}</span>
      </button>
      {open && node.children && (
        <div role="group" aria-label={node.name}>
          {node.children.map((child: any) => (
            child.type === 'directory' ? (
              <FileTreeFolder key={child.path} node={child} level={level + 1} onClick={onClick} />
            ) : (
              <FileTreeFile key={child.path} node={child} onClick={onClick} />
            )
          ))}
        </div>
      )}
    </div>
  );
}

interface FileTreeFileProps {
  node: { name: string; path: string; language?: string };
  isActive?: boolean;
  onClick: () => void;
}

function FileTreeFile({ node, isActive, onClick }: FileTreeFileProps) {
  const config = getLanguageConfig(node.language || '');
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded w-full text-left text-sm transition-colors font-arabic',
        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      )}
    >
      {config.icon || <FileText className="h-3.5 w-3.5" />}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function AgentPanel({ messages, input, onInputChange, onSend, isRunning, project }: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 font-arabic">
            <Bot className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>مرحباً! أنا وكيل البرمجة الذكي.</p>
            <p className="text-sm mt-1">اسألني عن الكود، اطلب ميزات جديدة، أو أصلح أخطاء.</p>
          </div>
        ) : (
          messages.map((msg: any, i: number) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0', msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                {msg.role === 'user' ? <span className="text-xs font-bold">أنت</span> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div className={cn('max-w-[80%] prose prose-sm dark:prose-invert', msg.role === 'user' ? 'text-right' : '')}>
                <p className="whitespace-pre-wrap font-arabic">{msg.content}</p>
                <span className="text-xs text-muted-foreground">{new Date(msg.timestamp).toLocaleTimeString('ar-SA')}</span>
              </div>
            </div>
          ))
        )}
        {isRunning && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
            <div className="prose prose-sm dark:prose-invert">
              <p className="font-arabic">جاري المعالجة...</p>
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={onInputChange}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSend())}
            placeholder="اكتب رسالتك... (Enter للإرسال، Shift+Enter لسطر جديد)"
            className="flex-1 font-arabic"
            disabled={isRunning}
          />
          <Button onClick={onSend} disabled={!input.trim() || isRunning} size="icon">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TerminalPanel({ output, input, onInputChange, onKeyDown }: any) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  return (
    <div className="h-full flex flex-col font-mono text-sm bg-black/20 rounded p-2">
      <div className="flex-1 overflow-y-auto whitespace-pre-wrap font-arabic" style={{ fontFamily: 'monospace' }}>
        {output}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-green-400">$</span>
        <Input
          ref={textareaRef}
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent border-none focus-visible:ring-0 font-mono text-sm"
          placeholder="اكتب أمراً..."
        />
      </div>
    </div>
  );
}

function ProblemsPanel() {
  return (
    <div className="h-full p-3 text-center text-muted-foreground font-arabic">
      <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
      <p>لا توجد مشاكل</p>
      <p className="text-sm mt-1">ستظهر أخطاء وتحذيرات الكود هنا</p>
    </div>
  );
}

function OutputPanel() {
  return (
    <div className="h-full p-3 text-center text-muted-foreground font-arabic">
      <p>مخرجات البناء والتشغيل ستظهر هنا</p>
    </div>
  );
}

// Import types
import type { ProjectFile, FileTreeNode } from '@app/types';
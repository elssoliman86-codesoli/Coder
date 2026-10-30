'use client';

import { useState, useRef, useEffect } from 'react';
import { Sidebar } from '@components/layout/Sidebar';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Badge } from '@components/ui/badge';
import { Textarea } from '@components/ui/textarea';
import { ScrollArea } from '@components/ui/scroll-area';
import { Separator } from '@components/ui/separator';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Switch } from '@components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import {
  Send,
  Bot,
  Terminal,
  FileText,
  Code,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Pause,
  Play,
  Trash2,
  Copy,
  Settings,
  Zap,
  MessageSquare,
  FolderOpen,
  Save,
  Download,
} from 'lucide-react';
import { cn } from '@lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  status?: 'pending' | 'running' | 'completed' | 'error';
}

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
  error?: boolean;
}

interface AgentTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  result?: string;
  error?: string;
}

const availableTools = [
  { name: 'read_file', description: 'قراءة ملف', category: 'files' },
  { name: 'write_file', description: 'كتابة ملف', category: 'files' },
  { name: 'edit_file', description: 'تعديل ملف', category: 'files' },
  { name: 'list_files', description: 'قائمة الملفات', category: 'files' },
  { name: 'glob', description: 'البحث عن ملفات بنمط', category: 'files' },
  { name: 'grep', description: 'البحث في محتوى الملفات', category: 'files' },
  { name: 'run_command', description: 'تشغيل أمر في الطرفية', category: 'terminal' },
  { name: 'run_tests', description: 'تشغيل الاختبارات', category: 'terminal' },
  { name: 'git_status', description: 'حالة Git', category: 'git' },
  { name: 'git_diff', description: 'مقارنة التغييرات', category: 'git' },
  { name: 'git_commit', description: 'إنشاء التزام', category: 'git' },
  { name: 'web_search', description: 'البحث في الويب', category: 'web' },
  { name: 'web_fetch', description: 'جلب صفحة ويب', category: 'web' },
];

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'مرحباً! أنا الوكيل المستقل في Coder. يمكنني مساعدتك في تنفيذ مهام معقدة تلقائياً مثل:\n\n• كتابة وتعديل الكود\n• تشغيل الأوامر والاختبارات\n• إدارة Git\n• البحث في الويب\n• تحليل الملفات والمشاريع\n\nاكتب مهمتك وسأبدأ في تنفيذها خطوة بخطوة.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [maxIterations, setMaxIterations] = useState(10);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [showTools, setShowTools] = useState(false);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTask, setActiveTask] = useState<AgentTask | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsRunning(true);

    // Simulate agent response
    await simulateAgentResponse(input);
  };

  const simulateAgentResponse = async (task: string) => {
    const taskId = `task-${Date.now()}`;
    const newTask: AgentTask = {
      id: taskId,
      name: task.slice(0, 50) + (task.length > 50 ? '...' : ''),
      description: task,
      status: 'running',
      createdAt: new Date(),
    };
    setTasks(prev => [newTask, ...prev]);
    setActiveTask(newTask);

    // Simulate thinking
    const thinkingMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: 'أفهم المهمة. دعني أبدأ في التخطيط والتنفيذ...',
      timestamp: new Date(),
      status: 'running',
    };
    setMessages(prev => [...prev, thinkingMessage]);

    // Simulate tool calls
    await new Promise(resolve => setTimeout(resolve, 1000));

    const toolCalls: ToolCall[] = [
      { id: 'tc-1', name: 'list_files', arguments: JSON.stringify({ path: '.' }) },
      { id: 'tc-2', name: 'read_file', arguments: JSON.stringify({ path: 'package.json' }) },
    ];

    const toolMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: 'سأبدأ باستكشاف هيكل المشروع أولاً.',
      timestamp: new Date(),
      toolCalls,
      status: 'running',
    };
    setMessages(prev => [...prev, toolMessage]);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const toolResults: ToolResult[] = [
      {
        toolCallId: 'tc-1',
        name: 'list_files',
        result: 'package.json\nsrc/\npublic/\nREADME.md\n.gitignore',
      },
      {
        toolCallId: 'tc-2',
        name: 'read_file',
        result: '{\n  "name": "coder",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.2.0",\n    "next": "^14.0.0"\n  }\n}',
      },
    ];

    const resultMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: 'وجدت مشروع Next.js مع React. الآن سأقوم بتنفيذ المهمة المطلوبة.',
      timestamp: new Date(),
      toolCalls,
      toolResults,
      status: 'completed',
    };
    setMessages(prev => [...prev, resultMessage]);

    // Final response
    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `✅ تم إنجاز المهمة: "${task}"\n\nلقد قمت بـ:\n1. استكشاف هيكل المشروع\n2. قراءة ملف التكوين\n3. تنفيذ الخطوات المطلوبة\n\nهل هناك شيء آخر تريدني أن أقوم به؟`,
      timestamp: new Date(),
      status: 'completed',
    };
    setMessages(prev => [...prev, finalMessage]);

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', completedAt: new Date(), result: 'مكتمل' } : t));
    setActiveTask(null);
    setIsRunning(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    if (activeTask) {
      setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, status: 'failed', error: 'تم الإيقاف يدوياً' } : t));
      setActiveTask(null);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'system',
        content: 'مرحباً! أنا الوكيل المستقل في Coder. يمكنني مساعدتك في تنفيذ مهام معقدة تلقائياً.',
        timestamp: new Date(),
      },
    ]);
  };

  const handleSaveSession = () => {
    const session = { messages, tasks, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        projects={[]}
        onSelectProject={() => {}}
        onNewProject={() => {}}
        onOpenFolder={() => {}}
        isMobileOpen={false}
        onCloseMobile={() => {}}
      />

      <div className="lg:pl-64 flex-1 flex flex-col h-screen">
        {/* Top Bar */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Bot className="h-6 w-6 text-primary" aria-hidden="true" />
              <h1 className="text-xl font-bold">الوكيل المستقل</h1>
              <Badge variant={isRunning ? 'default' : 'secondary'} className="gap-1">
                {isRunning ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    يعمل
                  </>
                ) : (
                  'جاهز'
                )}
              </Badge>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="النموذج" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                  <SelectItem value="ollama-llama3">Llama 3 (Ollama)</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 border-l border-border pl-3">
                <Label className="text-xs text-muted-foreground">تكرار تلقائي</Label>
                <Switch
                  checked={autoApprove}
                  onCheckedChange={setAutoApprove}
                  disabled={isRunning}
                  aria-label="الموافقة التلقائية على الأدوات"
                />
              </div>

              <div className="flex items-center gap-2 border-l border-border pl-3">
                <Label className="text-xs text-muted-foreground">الحد الأقصى</Label>
                <Select value={maxIterations.toString()} onValueChange={v => setMaxIterations(parseInt(v))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20, 30].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="ghost" size="icon" onClick={() => setShowTools(!showTools)} aria-label="عرض الأدوات">
                <Settings className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="outline" onClick={handleSaveSession} className="gap-1" disabled={messages.length <= 1}>
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                حفظ الجلسة
              </Button>
              <Button variant="outline" onClick={handleClear} className="gap-1">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                مسح
              </Button>
            </div>
          </div>

          {/* Tools Panel */}
          {showTools && (
            <div className="border-t border-border p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">الأدوات المتاحة ({availableTools.length})</span>
                <Badge variant="outline" size="sm">قراءة/كتابة</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {availableTools.map(tool => (
                  <Badge key={tool.name} variant="outline" size="sm" className="gap-1">
                    <Code className="h-3 w-3" aria-hidden="true" />
                    {tool.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <ScrollArea className="flex-1 p-4 space-y-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {messages.map(message => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t border-border p-4 bg-card/50 backdrop-blur-sm">
              <form onSubmit={handleSubmit} className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={isRunning ? 'الوكيل يعمل...' : 'اكتب مهمتك هنا... (Shift+Enter للسطر الجديد)'}
                    rows={1}
                    className="min-h-[44px] max-h-48 resize-none pr-12"
                    disabled={isRunning}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e as unknown as React.FormEvent);
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-12 rounded-full p-0"
                    disabled={!input.trim() || isRunning}
                    aria-label="إرسال المهمة"
                  >
                    {isRunning ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-5 w-5" aria-hidden="true" />
                    )}
                  </Button>
                  {isRunning && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleStop}
                      className="gap-1 h-8"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      إيقاف
                    </Button>
                  )}
                </div>
              </form>
              <p className="text-xs text-muted-foreground text-center mt-2">
                اضغط Enter للإرسال، Shift+Enter لسطر جديد
              </p>
            </div>
          </div>

          {/* Side Panel - Tasks & Context */}
          <div className="w-80 border-l border-border bg-card/50 backdrop-blur-sm flex flex-col hidden lg:flex">
            <Tabs defaultValue="tasks" className="flex-1 flex flex-col">
              <TabsList className="grid grid-cols-2 p-2">
                <TabsTrigger value="tasks">المهام ({tasks.length})</TabsTrigger>
                <TabsTrigger value="context">السياق</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="flex-1 overflow-hidden">
                <ScrollArea className="flex-1 p-3 space-y-2">
                  {tasks.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 text-sm">
                      لا توجد مهام بعد
                    </div>
                  ) : (
                    tasks.map(task => (
                      <TaskCard key={task.id} task={task} isActive={activeTask?.id === task.id} />
                    ))
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="context" className="flex-1 overflow-hidden">
                <ScrollArea className="flex-1 p-3 space-y-3">
                  <ContextSection title="الملفات المفتوحة" icon={FileText}>
                    <p className="text-sm text-muted-foreground">لا توجد ملفات مفتوحة</p>
                  </ContextSection>
                  <ContextSection title="المشروع الحالي" icon={FolderOpen}>
                    <p className="text-sm text-muted-foreground">لم يتم اختيار مشروع</p>
                  </ContextSection>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';

  if (isSystem) {
    return (
      <Alert className="border-primary/20 bg-primary/5">
        <AlertDescription className="text-sm whitespace-pre-wrap">{message.content}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <Code className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className={cn('flex-1 min-w-0', isUser ? 'text-right' : '')}>
        <div
          className={cn(
            'inline-block max-w-[80%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-none'
              : 'bg-muted rounded-tl-none'
          )}
        >
          {message.content}
        </div>

        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1" role="list" aria-label="استدعاءات الأدوات">
            {message.toolCalls.map(tc => (
              <ToolCallCard key={tc.id} call={tc} result={message.toolResults?.find(r => r.toolCallId === tc.id)} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
          <span>{message.timestamp.toLocaleTimeString('ar-EG')}</span>
          {message.status === 'running' && (
            <span className="flex items-center gap-1 text-primary">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              جاري التنفيذ...
            </span>
          )}
          {message.status === 'completed' && (
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle className="h-3 w-3" aria-hidden="true" />
              مكتمل
            </span>
          )}
          {message.status === 'error' && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              خطأ
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolCallCard({ call, result }: { call: ToolCall; result?: ToolResult }) {
  const isRunning = !result;
  const hasError = result?.error;

  return (
    <div
      className={cn(
        'px-3 py-2 rounded-lg border text-xs font-mono transition-colors',
        isRunning ? 'border-blue-500/50 bg-blue-500/5' : hasError ? 'border-destructive/50 bg-destructive/5' : 'border-green-500/50 bg-green-500/5'
      )}
      role="listitem"
    >
      <div className="flex items-center gap-2 mb-1">
        <Terminal className="h-3 w-3" aria-hidden="true" />
        <span className="font-medium">{call.name}</span>
        {isRunning && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        {!isRunning && !hasError && <CheckCircle className="h-3 w-3 text-green-500" aria-hidden="true" />}
        {hasError && <AlertCircle className="h-3 w-3 text-destructive" aria-hidden="true" />}
      </div>
      <div className="text-muted-foreground/80 px-2">{call.arguments}</div>
      {result && (
        <div className={cn('mt-1 px-2 text-[10px] font-mono max-h-24 overflow-auto', hasError ? 'text-destructive' : 'text-green-600 dark:text-green-400')}>
          {result.result}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, isActive }: { task: AgentTask; isActive: boolean }) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-all',
        isActive ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{task.name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
        </div>
        <Badge
          variant={
            task.status === 'running' ? 'default' :
            task.status === 'completed' ? 'success' :
            task.status === 'failed' ? 'destructive' : 'secondary'
          }
          size="sm"
        >
          {task.status === 'running' && <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" aria-hidden="true" />}
          {task.status === 'running' && 'قيد التنفيذ'}
          {task.status === 'pending' && 'معلق'}
          {task.status === 'completed' && 'مكتمل'}
          {task.status === 'failed' && 'فشل'}
        </Badge>
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
        <span>{task.createdAt.toLocaleTimeString('ar-EG')}</span>
        {task.completedAt && (
          <>
            <span>→</span>
            <span>{task.completedAt.toLocaleTimeString('ar-EG')}</span>
          </>
        )}
      </div>
      {task.result && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono max-h-16 overflow-auto">
          {task.result}
        </div>
      )}
      {task.error && (
        <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
          {task.error}
        </div>
      )}
    </div>
  );
}

function ContextSection({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {title}
      </div>
      <div className="pl-5 border-l border-border/50">
        {children}
      </div>
    </div>
  );
}
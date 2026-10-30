'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Loader2, Plus, Trash2, RotateCcw, MessageSquare } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ToolCallDisplay } from './ToolCallDisplay';
import { agentApi } from '@/features/agent/api/agentApi';
import type { Message, Conversation, AgentConfig } from '@/features/agent/types/agent';
import { cn } from '@/lib/utils';

interface AgentChatProps {
  conversationId?: string;
  config?: Partial<AgentConfig>;
  onConversationChange?: (conversation: Conversation) => void;
}

export function AgentChat({ conversationId, config, onConversationChange }: AgentChatProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'You are a helpful coding assistant. Be concise and practical.',
    tools: ['read_file', 'write_file', 'list_files', 'run_command', 'web_search', 'web_fetch', 'analyze_code', 'git_operations'],
    ...config,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load or create conversation
  useEffect(() => {
    const loadConversation = async () => {
      try {
        if (conversationId) {
          const conv = await agentApi.getConversation(conversationId);
          if (conv) {
            setConversation(conv);
            setMessages(conv.messages);
          }
        } else {
          // Create new conversation
          const newConv = await agentApi.createConversation({
            title: 'New Chat',
            config: agentConfig,
          });
          setConversation(newConv);
          onConversationChange?.(newConv);
        }
      } catch (err) {
        setError('Failed to load conversation');
        console.error(err);
      }
    };
    loadConversation();
  }, [conversationId, agentConfig, onConversationChange]);

  const handleSendMessage = async (content: string, attachments: File[]) => {
    if (!conversation || isLoading) return;

    setIsLoading(true);
    setError(null);

    // Add user message immediately
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: attachments.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
        url: URL.createObjectURL(f),
      })),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Send to agent API with streaming
      await agentApi.sendMessage(conversation.id, content, {
        config: agentConfig,
        onChunk: (chunk) => {
          if (chunk.type === 'content') {
            // Update last assistant message or create new one
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant' && lastMsg.metadata?.streaming) {
                return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + chunk.content }];
              }
              return [...prev, {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: chunk.content,
                timestamp: Date.now(),
                metadata: { streaming: true },
              }];
            });
          } else if (chunk.type === 'tool_call') {
            // Tool call will be added when tool_result comes
          } else if (chunk.type === 'tool_result') {
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant' && lastMsg.metadata?.streaming) {
                return [...prev.slice(0, -1), { ...lastMsg, metadata: { ...lastMsg.metadata, streaming: false } }];
              }
              return prev;
            });
          } else if (chunk.type === 'error') {
            setError(chunk.error || 'An error occurred');
          }
        },
      });

      // Refresh conversation to get updated messages
      const updated = await agentApi.getConversation(conversation.id);
      if (updated) {
        setConversation(updated);
        setMessages(updated.messages);
        onConversationChange?.(updated);
      }
    } catch (err) {
      setError('Failed to send message');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await agentApi.createConversation({
        title: 'New Chat',
        config: agentConfig,
      });
      setConversation(newConv);
      setMessages([]);
      onConversationChange?.(newConv);
    } catch (err) {
      setError('Failed to create conversation');
      console.error(err);
    }
  };

  const handleClearConversation = async () => {
    if (!conversation) return;
    try {
      await agentApi.deleteConversation(conversation.id);
      const newConv = await agentApi.createConversation({
        title: 'New Chat',
        config: agentConfig,
      });
      setConversation(newConv);
      setMessages([]);
      onConversationChange?.(newConv);
    } catch (err) {
      setError('Failed to clear conversation');
      console.error(err);
    }
  };

  const handleRegenerate = async () => {
    if (!conversation || messages.length === 0 || isLoading) return;

    // Find last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    // Remove messages after last user message
    const lastUserIndex = messages.findIndex(m => m.id === lastUserMsg.id);
    setMessages(prev => prev.slice(0, lastUserIndex + 1));

    // Resend
    await handleSendMessage(lastUserMsg.content, []);
  };

  const handleExport = () => {
    if (!conversation) return;
    const data = JSON.stringify(conversation, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversation.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-card">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-medium text-foreground">{conversation.title}</h1>
            <p className="text-xs text-muted-foreground">
              {messages.length} messages • {conversation.config?.model || 'gpt-4'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              showConfig && 'bg-primary/10 text-primary'
            )}
            aria-label="Settings"
            aria-expanded={showConfig}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={handleNewConversation} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="New conversation" title="New conversation">
            <Plus className="h-5 w-5" />
          </button>
          <button onClick={handleClearConversation} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Clear conversation" title="Clear conversation">
            <Trash2 className="h-5 w-5" />
          </button>
          <button onClick={handleRegenerate} disabled={isLoading || messages.length === 0} className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50" aria-label="Regenerate last response" title="Regenerate">
            <RotateCcw className="h-5 w-5" />
          </button>
          <button onClick={handleExport} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Export conversation" title="Export">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="border-b border-border p-4 bg-card/50 animate-slide-down">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Model</label>
              <select
                value={agentConfig.model}
                onChange={e => setAgentConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Temperature</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={agentConfig.temperature}
                onChange={e => setAgentConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">{agentConfig.temperature}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Max Tokens</label>
              <input
                type="number"
                value={agentConfig.maxTokens}
                onChange={e => setAgentConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agentConfig.tools.includes('web_search')}
                  onChange={e => setAgentConfig(prev => ({
                    ...prev,
                    tools: e.target.checked
                      ? [...prev.tools, 'web_search']
                      : prev.tools.filter(t => t !== 'web_search')
                  }))}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Web Search</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Toast */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center justify-between animate-slide-in">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-destructive/20 rounded" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card/50 p-4">
        <ChatInput
          ref={inputRef}
          onSend={handleSendMessage}
          disabled={isLoading}
          placeholder="Ask me anything... (Enter to send, Shift+Enter for new line)"
        />
      </div>
    </div>
  );
}

// Forward ref for ChatInput
const ForwardedAgentChat = React.forwardRef<HTMLDivElement, AgentChatProps>(
  (props, ref) => <AgentChat {...props} />
);
ForwardedAgentChat.displayName = 'AgentChat';

export { ForwardedAgentChat as AgentChat };
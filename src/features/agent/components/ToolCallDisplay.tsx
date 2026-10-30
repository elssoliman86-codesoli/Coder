'use client';

import { useState } from 'react';
import { cn } from '@lib/utils';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Terminal,
  Copy,
  Check,
} from 'lucide-react';
import { ToolCall, ToolResult } from '../types/agent';

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  toolResult?: ToolResult;
  compact?: boolean;
  onCopy?: (text: string) => void;
}

export function ToolCallDisplay({
  toolCall,
  toolResult,
  compact = false,
  onCopy,
}: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [copied, setCopied] = useState<string | null>(null);

  const status = toolResult
    ? toolResult.success
      ? 'success'
      : 'error'
    : 'running';

  const statusConfig = {
    pending: { icon: Loader2, color: 'text-blue-500', label: 'في الانتظار' },
    running: { icon: Loader2, color: 'text-blue-500 animate-spin', label: 'جاري التنفيذ...' },
    success: { icon: CheckCircle, color: 'text-green-500', label: 'نجح' },
    error: { icon: XCircle, color: 'text-red-500', label: 'فشل' },
  } as const;

  const currentStatus = statusConfig[status];
  const duration = toolResult?.duration ? ` (${toolResult.duration}ms)` : '';

  const formatArgs = (args: Record<string, unknown>) => {
    try {
      return JSON.stringify(args, null, 2);
    } catch {
      return String(args);
    }
  };

  const formatOutput = (output: unknown) => {
    if (typeof output === 'string') return output;
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
      onCopy?.(text);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border',
          status === 'error' && 'border-red-200 bg-red-50',
          status === 'success' && 'border-green-200 bg-green-50',
          status === 'running' && 'border-blue-200 bg-blue-50',
          'border-gray-200 bg-gray-50'
        )}
        role="status"
        aria-live="polite"
      >
        <currentStatus.icon className={cn('w-4 h-4', currentStatus.color)} aria-hidden="true" />
        <span className="text-sm font-mono text-gray-700">{toolCall.name}</span>
        <span className="text-xs text-gray-500">{currentStatus.label}{duration}</span>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-lg border border-gray-200 bg-gray-50 overflow-hidden"
      role="region"
      aria-label={`استدعاء أداة: ${toolCall.name}`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 transition-colors',
          'hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1'
        )}
        aria-expanded={expanded}
        aria-controls={`tool-call-${toolCall.id}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn('flex items-center gap-1.5', currentStatus.color)}>
            <currentStatus.icon className="w-4 h-4" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-800">{toolCall.name}</span>
            <span className="text-xs text-gray-500 font-mono">{toolCall.id.slice(0, 8)}...</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-2 py-0.5 rounded', currentStatus.color.replace('text-', 'bg-').replace('500', '100'))}>
            {currentStatus.label}{duration}
          </span>
          <ChevronDown
            className={cn('w-4 h-4 text-gray-400 transition-transform', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Expanded Content */}
      <div
        id={`tool-call-${toolCall.id}`}
        className={cn('overflow-hidden transition-all duration-200', expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0')}
        role="region"
        aria-label={`تفاصيل ${toolCall.name}`}
      >
        <div className="border-t border-gray-200 bg-white p-3 space-y-3">
          {/* Arguments */}
          <details className="group" open>
            <summary className="flex items-center gap-2 cursor-pointer select-none">
              <FileText className="w-4 h-4 text-gray-400" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-700">المعالم (Arguments)</span>
            </summary>
            <div className="mt-2 relative">
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-60 font-mono">
                {formatArgs(toolCall.arguments)}
              </pre>
              <button
                type="button"
                onClick={() => copyToClipboard(formatArgs(toolCall.arguments), 'arguments')}
                className="absolute top-2 right-2 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                aria-label="نسخ المعالم"
              >
                {copied === 'arguments' ? (
                  <>
                    <Check className="w-3 h-3 inline mr-1" aria-hidden="true" />
                    تم النسخ
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 inline mr-1" aria-hidden="true" />
                    نسخ
                  </>
                )}
              </button>
            </div>
          </details>

          {/* Result */}
          {toolResult && (
            <details className="group" open>
              <summary className="flex items-center gap-2 cursor-pointer select-none">
                <Terminal className="w-4 h-4 text-gray-400" aria-hidden="true" />
                <span className="text-sm font-medium text-gray-700">
                  النتيجة ({toolResult.success ? 'نجح' : 'فشل'})
                </span>
                {toolResult.duration && (
                  <span className="text-xs text-gray-500 ml-auto">{toolResult.duration}ms</span>
                )}
              </summary>
              <div className="mt-2 relative">
                <pre
                  className={cn(
                    'bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-60 font-mono',
                    !toolResult.success && 'border-l-4 border-red-500'
                  )}
                >
                  {formatOutput(toolResult.output)}
                </pre>
                <button
                  type="button"
                  onClick={() => copyToClipboard(formatOutput(toolResult.output), 'output')}
                  className="absolute top-2 right-2 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                  aria-label="نسخ النتيجة"
                >
                  {copied === 'output' ? (
                    <>
                      <Check className="w-3 h-3 inline mr-1" aria-hidden="true" />
                      تم النسخ
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 inline mr-1" aria-hidden="true" />
                      نسخ
                    </>
                  )}
                </button>
              </div>
            </details>
          )}

          {/* Error Details */}
          {toolResult && !toolResult.success && toolResult.error && (
            <details className="group" open>
              <summary className="flex items-center gap-2 cursor-pointer select-none">
                <AlertTriangle className="w-4 h-4 text-red-500" aria-hidden="true" />
                <span className="text-sm font-medium text-red-600">خطأ</span>
              </summary>
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 font-mono">
                {toolResult.error}
              </div>
            </details>
          )}

          {/* Logs */}
          {toolResult?.logs && toolResult.logs.length > 0 && (
            <details>
              <summary className="flex items-center gap-2 cursor-pointer select-none">
                <FileText className="w-4 h-4 text-gray-400" aria-hidden="true" />
                <span className="text-sm font-medium text-gray-700">السجلات ({toolResult.logs.length})</span>
              </summary>
              <div className="mt-2 relative">
                <pre className="bg-gray-100 text-gray-800 p-3 rounded text-xs overflow-x-auto max-h-40 font-mono">
                  {toolResult.logs.map((log, i) => `[${i + 1}] ${log}`).join('\n')}
                </pre>
                <button
                  type="button"
                  onClick={() => copyToClipboard(toolResult.logs!.join('\n'), 'logs')}
                  className="absolute top-2 right-2 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                  aria-label="نسخ السجلات"
                >
                  {copied === 'logs' ? (
                    <>
                      <Check className="w-3 h-3 inline mr-1" aria-hidden="true" />
                      تم النسخ
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 inline mr-1" aria-hidden="true" />
                      نسخ
                    </>
                  )}
                </button>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
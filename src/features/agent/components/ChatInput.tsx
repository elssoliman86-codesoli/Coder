'use client';

import { useState, useRef, useCallback, KeyboardEvent, FormEvent } from 'react';
import { cn } from '@lib/utils';
import { Paperclip, Send, Mic, Smile, Loader2 } from 'lucide-react';

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  showAttachments?: boolean;
  showVoice?: boolean;
  showEmoji?: boolean;
}

export const ChatInput = forwardRef<HTMLDivElement, ChatInputProps>(
  (
    {
      value,
      onChange,
      onSend,
      disabled = false,
      placeholder = 'اكتب رسالة...',
      maxLength = 4000,
      showAttachments = true,
      showVoice = false,
      showEmoji = false,
    },
    ref
  ) => {
    const [isComposing, setIsComposing] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = useCallback(
      (e: FormEvent) => {
        e.preventDefault();
        if (!value.trim() && attachments.length === 0) return;
        if (disabled) return;

        onSend(value, attachments.length > 0 ? attachments : undefined);
        onChange('');
        setAttachments([]);
        setShowAttachmentPreview(false);
        textareaRef.current?.focus();
      },
      [value, attachments, disabled, onSend, onChange]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
          e.preventDefault();
          handleSubmit(e);
        }
      },
      [handleSubmit, isComposing]
    );

    const handleCompositionStart = () => setIsComposing(true);
    const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      setIsComposing(false);
      onChange(e.currentTarget.value);
    };

    const handleFileSelect = (files: FileList) => {
      const newFiles = Array.from(files);
      const validFiles = newFiles.filter(
        (f) => f.size <= 10 * 1024 * 1024
      );
      if (validFiles.length !== newFiles.length) {
        // TODO: show toast for skipped files
      }
      setAttachments((prev) => [...prev, ...validFiles]);
      setShowAttachmentPreview(validFiles.length > 0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
    }, [value]);

    // Auto-resize textarea
    if (typeof window !== 'undefined') {
      requestAnimationFrame(adjustHeight);
    }

    return (
      <div
        ref={ref}
        className={cn(
          'bg-card border-t border-border p-4',
          'transition-colors duration-200'
        )}
      >
        {showAttachmentPreview && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-border" role="list" aria-label="المرفقات">
            {attachments.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full text-sm"
                role="listitem"
              >
                <span className="truncate max-w-[150px]">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="p-0.5 hover:bg-secondary/50 rounded-full transition-colors"
                  aria-label={`إزالة ${file.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          {showAttachments && (
            <label htmlFor="chat-file-input" className="p-2 hover:bg-accent rounded-full transition-colors shrink-0" aria-label="إرفاق ملف">
              <Paperclip className="w-5 h-5 text-muted-foreground" />
              <input
                id="chat-file-input"
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.js,.ts,.jsx,.tsx,.json,.py,.java,.cpp,.cs,.go,.rs,.php,.rb,.swift,.kt,.html,.css,.scss,.yaml,.yml,.xml,.svg,.png,.jpg,.jpeg,.gif,.webp,.pdf"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                className="hidden"
                disabled={disabled}
              />
            </label>
          )}

          <div className="flex-1 relative min-w-0">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={placeholder}
              maxLength={maxLength}
              disabled={disabled}
              rows={1}
              className={cn(
                'w-full bg-background border border-input rounded-xl px-4 py-3',
                'text-base placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'resize-none pr-12',
                'rtl'
              )}
              style={{ minHeight: '48px', maxHeight: '160px' }}
              aria-label={placeholder}
              aria-describedby={attachments.length > 0 ? 'attachment-count' : undefined}
            />
            {attachments.length > 0 && (
              <span id="attachment-count" className="sr-only">
                {attachments.length} ملف مرفق
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {showEmoji && (
              <button
                type="button"
                className="p-2 hover:bg-accent rounded-full transition-colors"
                aria-label="إيموجي"
              >
                <Smile className="w-5 h-5 text-muted-foreground" />
              </button>
            )}

            {showVoice && (
              <button
                type="button"
                className="p-2 hover:bg-accent rounded-full transition-colors"
                aria-label="تسجيل صوتي"
              >
                <Mic className="w-5 h-5 text-muted-foreground" />
              </button>
            )}

            <button
              type="submit"
              disabled={disabled || (!value.trim() && attachments.length === 0)}
              className={cn(
                'p-2.5 rounded-full transition-all duration-200 shrink-0',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 active:scale-[0.98]',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
              )}
              aria-label="إرسال الرسالة"
            >
              {disabled ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{value.length}/{maxLength}</span>
          <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">Enter</kbd>
          <span className="hidden sm:inline">لإرسال · </span>
          <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">Shift+Enter</kbd>
          <span className="hidden sm:inline"> لسطر جديد</span>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
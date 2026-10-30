import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `منذ ${days} يوم${days > 1 ? '' : ''}`;
  if (hours > 0) return `منذ ${hours} ساعة${hours > 1 ? '' : ''}`;
  if (minutes > 0) return `منذ ${minutes} دقيقة${minutes > 1 ? '' : ''}`;
  return 'الآن';
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function getLanguageIcon(language: string): string {
  const icons: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    python: 'py',
    dart: 'dart',
    kotlin: 'kt',
    java: 'java',
    csharp: 'cs',
    go: 'go',
    rust: 'rs',
    cpp: 'cpp',
    c: 'c',
    php: 'php',
    html: 'html',
    css: 'css',
    shell: 'sh',
    sql: 'sql',
    json: 'json',
    yaml: 'yaml',
    markdown: 'md'
  };
  return icons[language.toLowerCase()] || 'file';
}

export function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    typescript: 'text-blue-400',
    javascript: 'text-yellow-400',
    python: 'text-green-400',
    dart: 'text-cyan-400',
    kotlin: 'text-purple-400',
    java: 'text-red-400',
    csharp: 'text-purple-400',
    go: 'text-cyan-400',
    rust: 'text-orange-400',
    cpp: 'text-blue-400',
    c: 'text-blue-400',
    php: 'text-purple-400',
    html: 'text-orange-400',
    css: 'text-blue-400',
    shell: 'text-green-400',
    sql: 'text-orange-400',
    json: 'text-yellow-400',
    yaml: 'text-red-400',
    markdown: 'text-gray-400'
  };
  return colors[language.toLowerCase()] || 'text-gray-400';
}

export function getFileExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

export function getLanguageFromPath(path: string): string {
  const ext = getFileExtension(path);
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    dart: 'dart',
    kt: 'kotlin',
    kts: 'kotlin',
    java: 'java',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    php: 'php',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'css',
    sass: 'css',
    less: 'css',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    sql: 'sql',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    mdx: 'markdown'
  };
  return map[ext] || 'text';
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoff = 2
): Promise<T> {
  return fn().catch(err => {
    if (retries <= 0) throw err;
    return sleep(delay).then(() => retry(fn, retries - 1, delay * backoff, backoff));
  });
}

export function parseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'حدث خطأ غير معروف';
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
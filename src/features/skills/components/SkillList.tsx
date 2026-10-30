'use client';

import { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { Search, Filter, X, Loader2, ChevronDown } from 'lucide-react';
import { Skill, SkillCategory } from '../../types/skill';
import { SkillCard } from './SkillCard';
import { cn } from '@lib/utils';

interface SkillListProps {
  skills: Skill[];
  installedSkillIds: Set<string>;
  onInstall: (skillId: string) => Promise<void>;
  onUninstall: (skillId: string) => Promise<void>;
  onRun: (skillId: string) => Promise<void>;
  loadingSkillId?: string | null;
}

export function SkillList({
  skills,
  installedSkillIds,
  onInstall,
  onUninstall,
  onRun,
  loadingSkillId,
}: SkillListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'updated' | 'popularity'>('name');

  const categories: { value: SkillCategory | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: 'الكل', icon: '📦' },
    { value: 'security', label: 'الأمان', icon: '🔒' },
    { value: 'development', label: 'التطوير', icon: '💻' },
    { value: 'analysis', label: 'التحليل', icon: '📊' },
    { value: 'automation', label: 'الأتمتة', icon: '⚙️' },
    { value: 'testing', label: 'الاختبار', icon: '🧪' },
    { value: 'documentation', label: 'التوثيق', icon: '📚' },
    { value: 'deployment', label: 'النشر', icon: '🚀' },
    { value: 'utility', label: 'أدوات', icon: '🛠️' },
  ];

  const filteredSkills = useMemo(() => {
    let result = [...skills];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query) ||
          skill.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          skill.author.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((skill) => skill.category === selectedCategory);
    }

    // Installed only filter
    if (showInstalledOnly) {
      result = result.filter((skill) => installedSkillIds.has(skill.id));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name, 'ar');
        case 'category':
          return a.category.localeCompare(b.category, 'ar');
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'popularity':
          return (b.metadata?.downloads || 0) - (a.metadata?.downloads || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [skills, searchQuery, selectedCategory, showInstalledOnly, sortBy]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory !== 'all' || showInstalledOnly;

  return (
    <div className="space-y-4">
      {/* Search & Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="ابحث عن مهارة بالاسم، الوصف، أو الوسوم..."
            className={cn(
              'w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-lg',
              'text-sm placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
              'rtl:pr-10 rtl:pl-3'
            )}
            aria-label="البحث في المهارات"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="مسح البحث"
            >
              <X size={16} />
            </button>
          )}
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="relative">
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 bg-background border border-border rounded-lg',
                'text-sm font-medium text-foreground',
                'hover:border-primary/50 transition-colors',
                selectedCategory !== 'all' && 'border-primary text-primary'
              )}
              aria-haspopup="listbox"
              aria-expanded="false"
              aria-label="تصفية حسب الفئة"
            >
              <span className="text-base" aria-hidden="true">
                {categories.find((c) => c.value === selectedCategory)?.icon || '📦'}
              </span>
              <span>{categories.find((c) => c.value === selectedCategory)?.label || 'الكل'}</span>
              <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />
            </button>
            {/* Simple dropdown - in production use a proper combobox */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as SkillCategory | 'all')}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="اختر الفئة"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Installed Only Toggle */}
          <button
            type="button"
            onClick={() => setShowInstalledOnly(!showInstalledOnly)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 bg-background border rounded-lg',
              'text-sm font-medium transition-colors',
              showInstalledOnly
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-foreground hover:border-primary/50'
            )}
            aria-pressed={showInstalledOnly}
            aria-label="إظهار المثبتة فقط"
          >
            <Filter size={16} aria-hidden="true" />
            <span>المثبتة</span>
          </button>

          {/* Sort Select */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
            aria-label="ترتيب حسب"
          >
            <option value="name">الاسم</option>
            <option value="category">الفئة</option>
            <option value="updated">الأحدث تعديلاً</option>
            <option value="popularity">الأكثر تحميلاً</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setShowInstalledOnly(false);
              }}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              aria-label="مسح الفلاتر"
            >
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground flex items-center justify-between">
        <span>
          {filteredSkills.length} مهارة{filteredSkills.length !== skills.length ? ` من ${skills.length}` : ''}
          {searchQuery && ` لـ "${searchQuery}"`}
        </span>
        {loadingSkillId && (
          <span className="flex items-center gap-1.5 text-primary">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            جاري العملية...
          </span>
        )}
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-3" aria-hidden="true">📦</div>
          <h3 className="text-lg font-medium text-foreground mb-1">
            {searchQuery || hasActiveFilters ? 'لا توجد نتائج' : 'لا توجد مهارات متاحة'}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery || hasActiveFilters
              ? 'جرب تغيير كلمات البحث أو مسح الفلاتر'
              : 'تحقق من اتصالك بالإنترنت أو أضف مهارات مخصصة'}
          </p>
          {(searchQuery || hasActiveFilters) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setShowInstalledOnly(false);
              }}
              className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              مسح جميع الفلاتر
            </button>
          )}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          role="list"
          aria-label="قائمة المهارات"
        >
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isInstalled={installedSkillIds.has(skill.id)}
              onInstall={onInstall}
              onUninstall={onUninstall}
              onRun={onRun}
              isLoading={loadingSkillId === skill.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
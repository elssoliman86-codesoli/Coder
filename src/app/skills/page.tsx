'use client';

import { useState, useEffect } from 'react';
import { SkillList } from '@/features/skills/components/SkillList';
import { SkillSearch } from '@/features/skills/components/SkillSearch';
import { SkillCategoryTabs } from '@/features/skills/components/SkillCategoryTabs';
import { skillsApi } from '@/features/skills/api/skillsApi';
import { Skill, SkillCategory } from '@/features/skills/types/skill';
import { Search, Download, RefreshCw, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'recent' | 'popular'>('name');
  const [error, setError] = useState<string | null>(null);

  const loadSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const allSkills = await skillsApi.getAllSkills();
      const installed = await skillsApi.getInstalledSkills();
      setSkills(allSkills);
      setInstalledIds(new Set(installed.map(s => s.id)));
    } catch (err) {
      setError('فشل تحميل المهارات');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleInstall = async (skill: Skill) => {
    try {
      await skillsApi.installSkill(skill.id);
      setInstalledIds(prev => new Set([...prev, skill.id]));
    } catch (err) {
      console.error('فشل التثبيت:', err);
    }
  };

  const handleUninstall = async (skillId: string) => {
    try {
      await skillsApi.uninstallSkill(skillId);
      setInstalledIds(prev => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    } catch (err) {
      console.error('فشل إلغاء التثبيت:', err);
    }
  };

  const handleRun = async (skill: Skill) => {
    try {
      const result = await skillsApi.executeSkill(skill.id, {});
      alert(`نتيجة التنفيذ: ${result.success ? 'نجح' : 'فشل'}\n${result.output || result.error || ''}`);
    } catch (err) {
      console.error('فشل التنفيذ:', err);
    }
  };

  const filteredSkills = skills.filter(skill => {
    if (showInstalledOnly && !installedIds.has(skill.id)) return false;
    if (selectedCategory !== 'all' && skill.category !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matches = 
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.tags.some(t => t.toLowerCase().includes(query)) ||
        skill.author.toLowerCase().includes(query);
      if (!matches) return false;
    }
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name, 'ar');
      case 'category': return a.category.localeCompare(b.category, 'ar');
      case 'recent': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'popular': return (b.metadata?.downloads || 0) - (a.metadata?.downloads || 0);
      default: return 0;
    }
  });

  const categories: { value: SkillCategory | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: 'الكل', icon: 'grid' },
    { value: 'security', label: 'الأمان', icon: 'shield' },
    { value: 'development', label: 'التطوير', icon: 'code' },
    { value: 'analysis', label: 'التحليل', icon: 'search' },
    { value: 'automation', label: 'الأتمتة', icon: 'zap' },
    { value: 'testing', label: 'الاختبار', icon: 'check-circle' },
    { value: 'documentation', label: 'التوثيق', icon: 'file-text' },
    { value: 'deployment', label: 'النشر', icon: 'rocket' },
    { value: 'utility', label: 'أدوات', icon: 'tool' },
  ];

  const categoryIcons: Record<string, React.ReactNode> = {
    grid: <Search className="w-4 h-4" />,
    shield: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    code: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    search: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    zap: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    'check-circle': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    'file-text': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    rocket: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5.5-1.5c1.45-.79 2.83-1.8 4-3.15"/><path d="M12 15h6"/><path d="M4.5 16.5c0 0-.83-3.6 1.5-5.36 1.86-1.4 4.32-2.2 6.53-2.2S16.5 10.5 16.5 10.5c1.66 0 3.64 1.2 4.5 2.82"/></svg>,
    tool: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المهارات (Skills)</h1>
          <p className="text-muted-foreground mt-1">
            اكتشف وثبّت المهارات لتوسيع قدرات الوكيل
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSkills}
            disabled={loading}
            className="btn btn-ghost btn-sm flex items-center gap-2"
            aria-label="تحديث القائمة"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            تحديث
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 flex items-center gap-3" role="alert">
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
          <button onClick={loadSkills} className="btn btn-sm btn-ghost ml-auto">إعادة المحاولة</button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <SkillSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="ابحث بالاسم، الوصف، الوسوم، المؤلف..."
          aria-label="البحث في المهارات"
        />
        <div className="flex flex-wrap items-center gap-3">
          <SkillCategoryTabs
            value={selectedCategory}
            onChange={setSelectedCategory}
            categories={categories.map(c => c.value)}
            getLabel={(v) => categories.find(c => c.value === v)?.label || v}
            getIcon={(v) => categoryIcons[categories.find(c => c.value === v)?.icon || 'grid']}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInstalledOnly}
              onChange={e => setShowInstalledOnly(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground">المثبتة فقط</span>
          </label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="select select-sm w-auto"
            aria-label="ترتيب حسب"
          >
            <option value="name">الاسم</option>
            <option value="category">الفئة</option>
            <option value="recent">الأحدث</option>
            <option value="popular">الأكثر تحميلاً</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{filteredSkills.length} من {skills.length} مهارة</span>
        <span className="text-primary">✓ {installedIds.size} مثبتة</span>
      </div>

      {/* Skills List */}
      <SkillList
        skills={filteredSkills}
        installedIds={installedIds}
        loading={loading}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        onRun={handleRun}
      />
    </div>
  );
}
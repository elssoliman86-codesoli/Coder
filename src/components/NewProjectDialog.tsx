import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderPlus, X } from 'lucide-react';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (project: { name: string; template: string; path: string }) => void;
}

const TEMPLATES = [
  { id: 'blank', name: 'مشروع فارغ', description: 'ابدأ من الصفر' },
  { id: 'react', name: 'React + TypeScript', description: 'تطبيق React حديث مع TypeScript' },
  { id: 'nextjs', name: 'Next.js', description: 'إطار عمل React كامل الميزات' },
  { id: 'vue', name: 'Vue + TypeScript', description: 'تطبيق Vue 3 مع Composition API' },
  { id: 'html', name: 'HTML/CSS/JS', description: 'موقع ثابت بسيط' },
  { id: 'node', name: 'Node.js', description: 'خادم خلفي بـ Express' },
  { id: 'python', name: 'Python', description: 'مشروع Python بسيط' },
];

export function NewProjectDialog({ open, onOpenChange, onCreate }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('blank');
  const [path, setPath] = useState('/storage/emulated/0/Download/CoderProjects');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('الرجاء إدخال اسم المشروع');
      return;
    }
    if (!path.trim()) {
      setError('الرجاء تحديد مسار المشروع');
      return;
    }
    onCreate({ name: name.trim(), template, path: path.trim() });
    setName('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            مشروع جديد
          </DialogTitle>
          <DialogDescription>
            أنشئ مشروع كود جديد من قالب جاهز
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">اسم المشروع</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-awesome-project"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">القالب</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger id="template">
                <SelectValue placeholder="اختر قالباً" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="path">مسار الحفظ</Label>
            <Input
              id="path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/storage/emulated/0/Download/CoderProjects"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive flex items-center gap-1">
              <X className="h-3 w-3" />
              {error}
            </div>
          )}
        </form>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" form="new-project-form" disabled={!name.trim()}>
            إنشاء المشروع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
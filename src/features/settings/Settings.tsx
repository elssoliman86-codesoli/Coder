import { useSettings, useStore } from '@app/store';
import { Button } from '@components/ui/button';

export function Settings() {
  const settings = useSettings();
  const updateSettings = useStore(s=>s.updateSettings);
  return <section className="mx-auto max-w-2xl space-y-6"><div><h1 className="text-2xl font-bold">الإعدادات</h1><p className="mt-2 text-sm text-muted-foreground">تخصيص واجهة التطبيق.</p></div>
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <label className="flex items-center justify-between gap-4"><span>لغة الواجهة</span><select className="input-field max-w-40" value={settings.language} onChange={e=>updateSettings({language:e.target.value as 'ar'|'en'})}><option value="ar">العربية</option><option value="en">English</option></select></label>
      <label className="flex items-center justify-between gap-4"><span>المظهر</span><select className="input-field max-w-40" value={settings.theme} onChange={e=>updateSettings({theme:e.target.value as 'dark'|'light'|'system'})}><option value="dark">داكن</option><option value="light">فاتح</option><option value="system">النظام</option></select></label>
      <label className="flex items-center justify-between gap-4"><span>حفظ تلقائي</span><input type="checkbox" checked={settings.autoSave} onChange={e=>updateSettings({autoSave:e.target.checked})}/></label>
      <Button variant="outline" onClick={()=>{localStorage.removeItem('2onebyte-coder-storage');window.location.reload()}}>إعادة ضبط بيانات التطبيق</Button>
      <p className="text-xs text-muted-foreground">إعادة الضبط تحذف بيانات المشاريع والإعدادات المخزنة محليًا على هذا الجهاز.</p>
    </div>
  </section>;
}

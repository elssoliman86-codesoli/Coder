import type { Skill } from '@app/types';

export function loadBuiltinSkills(): Skill[] {
  return [{
    name: 'project-basics',
    description: 'إرشادات أساسية لتنظيم ملفات المشروع',
    appliesTo: ['website','apk','cli','library','exe'],
    triggers: ['new project','project structure'],
    always: true,
    instructions: 'حافظ على بنية واضحة، واكتب أسماء ملفات مفهومة، ولا تدّعِ تنفيذ وظائف غير موجودة.',
    enabled: true,
    frontmatter: { name:'project-basics', description:'إرشادات أساسية لتنظيم ملفات المشروع', applies_to:['website','apk','cli','library','exe'], triggers:['new project','project structure'], always:true },
    content: 'ابدأ ببنية صغيرة قابلة للاختبار.'
  }];
}

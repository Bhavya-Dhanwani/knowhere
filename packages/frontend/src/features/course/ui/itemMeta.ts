import { Code2, FileText, ListChecks, LucideIcon, PlayCircle } from 'lucide-react';
import { ItemType } from '../api/contentApi';

export const ITEM_META: Record<ItemType, { label: string; icon: LucideIcon; tint: string }> = {
  video: { label: 'Video', icon: PlayCircle, tint: 'bg-rose-50 text-rose-600 ring-rose-200/70' },
  resource: { label: 'Resource', icon: FileText, tint: 'bg-sky-50 text-sky-600 ring-sky-200/70' },
  mcq: { label: 'Quiz', icon: ListChecks, tint: 'bg-amber-50 text-amber-600 ring-amber-200/70' },
  'code-question': {
    label: 'Coding',
    icon: Code2,
    tint: 'bg-emerald-50 text-emerald-600 ring-emerald-200/70'
  }
};

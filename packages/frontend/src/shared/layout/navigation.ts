import {
  Bot,
  BookOpen,
  Compass,
  FileCode2,
  Library,
  LayoutDashboard,
  LucideIcon,
  MessagesSquare,
  Sparkles,
  Users
} from 'lucide-react';
import { AppRole } from '../lib/roles';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  // extra path prefixes that should also mark this item active
  match?: string[];
  badge?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

const community: NavItem = { label: 'Community', to: '/chat', icon: MessagesSquare, badge: 'live' };
const docs: NavItem = { label: 'API reference', to: '/docs', icon: FileCode2 };
const coach: NavItem = { label: 'AI Coach', to: '/coach', icon: Bot };

export function navFor(role: AppRole): NavSection[] {
  if (role === 'admin') {
    return [
      {
        items: [
          { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
          { label: 'Courses', to: '/admin/courses', icon: BookOpen, match: ['/admin/course/'] },
          { label: 'Content', to: '/library', icon: Library },
          { label: 'Users', to: '/admin/people', icon: Users }
        ]
      },
      {
        title: 'Workspace',
        items: [
          { label: 'Project reviews', to: '/review', icon: Sparkles },
          coach,
          community,
          { label: 'Course catalog', to: '/courses', icon: Compass, match: ['/course/'] }
        ]
      },
      { title: 'Resources', items: [docs] }
    ];
  }

  if (role === 'trainer') {
    return [
      {
        items: [
          { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
          { label: 'Courses', to: '/courses', icon: BookOpen, match: ['/course/'] },
          { label: 'Content library', to: '/library', icon: Library },
          { label: 'Project reviews', to: '/review', icon: Sparkles },
          coach,
          community
        ]
      },
      { title: 'Resources', items: [docs] }
    ];
  }

  return [
    {
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
        { label: 'My courses', to: '/courses', icon: BookOpen, match: ['/course/'] },
        {
          label: 'My project reviews',
          to: '/review/my',
          icon: Sparkles,
          match: ['/review/submit/']
        },
        coach,
        community
      ]
    },
    { title: 'Resources', items: [docs] }
  ];
}

export function isActive(item: NavItem, pathname: string) {
  if (pathname === item.to) return true;
  // course communities live under /course/:id but belong to the Community tab
  if (pathname.endsWith('/community')) return item.to === '/chat';
  return (item.match || []).some((m) => pathname.startsWith(m));
}

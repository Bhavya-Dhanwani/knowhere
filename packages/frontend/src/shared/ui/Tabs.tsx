import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  tabClassName?: string;
  variant?: 'underline' | 'pill';
}

// Horizontally scrollable on narrow screens; the active indicator slides between tabs.
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  tabClassName,
  variant = 'underline'
}) => {
  const layoutId = React.useId();
  const pill = variant === 'pill';

  return (
    <div
      role="tablist"
      className={cn(
        'no-scrollbar flex max-w-full items-center overflow-x-auto',
        pill ? 'gap-1 rounded-xl bg-zinc-100 p-1' : 'gap-5 border-b border-zinc-200/80',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors',
              pill ? 'h-8 rounded-lg px-3' : 'pb-3 pt-1',
              isActive ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800',
              tabClassName
            )}
          >
            {isActive ? (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className={cn(
                  'absolute',
                  pill
                    ? 'inset-0 rounded-lg bg-white shadow-card'
                    : '-bottom-px left-0 right-0 h-0.5 rounded-full bg-zinc-900'
                )}
              />
            ) : null}
            <span className="relative flex items-center gap-1.5">
              {tab.icon ? <span className="shrink-0">{tab.icon}</span> : null}
              {tab.label}
              {tab.badge ? <span className="shrink-0">{tab.badge}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
};

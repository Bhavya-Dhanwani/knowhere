import React from 'react';
import { SubmoduleRow } from './SubmoduleRow';
import { Module } from '../../../shared/types';

export interface ModuleTreeItemProps {
  module: Module;
  isOpen: boolean;
  onToggle: () => void;
  selectedItemId: string | null;
  onSelectContentItem: (itemId: string) => void;
}

export const ModuleTreeItem: React.FC<ModuleTreeItemProps> = ({
  module,
  isOpen,
  onToggle,
  selectedItemId,
  onSelectContentItem
}) => {
  const completedCount = module.submodules.filter((s) => s.status === 'completed').length;
  const totalCount = module.submodules.length;

  return (
    <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden shadow-sm transition-all">
      {/* Module Header Accordion Trigger */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {module.order}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{module.title}</h3>
            <p className="text-[11px] text-muted mt-0.5">
              {completedCount} of {totalCount} sub-modules completed
            </p>
          </div>
        </div>

        <svg
          className={`w-4 h-4 text-muted transition-transform duration-300 shrink-0 ml-2 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Submodule List */}
      {isOpen ? (
        <div className="px-4 pb-4 space-y-2.5 pt-1 border-t border-white/5 animate-in fade-in duration-200">
          {module.submodules.map((submodule) => (
            <SubmoduleRow
              key={submodule.id}
              submodule={submodule}
              selectedItemId={selectedItemId}
              onSelectContentItem={onSelectContentItem}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

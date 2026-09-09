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
  return (
    <div className="transition-colors">
      {/* Module Header Accordion Trigger - Toggles only, does NOT redirect */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors focus:outline-none select-none group"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
            {module.title}
          </h3>

          {/* Module Badges */}
          <div className="flex items-center gap-2">
            {module.isNew && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                New
              </span>
            )}
            {module.status === 'completed' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Completed
              </span>
            )}
          </div>
        </div>

        {/* Right Chevron Toggle with smooth 300ms rotation */}
        <div className="text-slate-400 group-hover:text-slate-600 transition-colors p-1 shrink-0">
          <svg
            className={`w-4 h-4 transition-transform duration-300 ease-in-out ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Submodule List - Animated Accordion using CSS Grid */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-4 pt-2 space-y-1 bg-slate-50/40 border-t border-slate-100">
            <div className="pl-3 sm:pl-5 border-l-2 border-slate-200/80 ml-2 space-y-1">
              {module.submodules.map((submodule, index) => (
                <div
                  key={submodule.id}
                  className={`transition-all duration-300 ease-out transform ${
                    isOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
                  }`}
                  style={{
                    transitionDelay: isOpen ? `${Math.min(index * 35, 200)}ms` : '0ms'
                  }}
                >
                  <SubmoduleRow
                    submodule={submodule}
                    selectedItemId={selectedItemId}
                    onSelectContentItem={onSelectContentItem}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

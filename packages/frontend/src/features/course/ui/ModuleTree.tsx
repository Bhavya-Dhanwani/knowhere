import React, { useState } from 'react';
import { ModuleTreeItem } from './ModuleTreeItem';
import { Module } from '../../../shared/types';

export interface ModuleTreeProps {
  modules: Module[];
  selectedItemId: string | null;
  onSelectContentItem: (itemId: string) => void;
}

export const ModuleTree: React.FC<ModuleTreeProps> = ({
  modules,
  selectedItemId,
  onSelectContentItem
}) => {
  const [activeTab, setActiveTab] = useState<'modules' | 'announcements'>('modules');
  // Default mod-threejs open to match exact screenshot, with full toggle support for all
  const [openModuleIds, setOpenModuleIds] = useState<Record<string, boolean>>({
    'mod-threejs': true,
    'mod-dsa': false,
    'mod-backend': false,
    'mod-aptitude': false,
    'mod-frontend': false
  });

  const toggleModule = (id: string) => {
    setOpenModuleIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Island Top Bar - Tabs with bottom active indicator */}
      <div className="px-5 pt-3 pb-0 border-b border-slate-100 flex items-center gap-6 shrink-0 bg-white">
        <button
          type="button"
          onClick={() => setActiveTab('modules')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'modules'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span>All Modules</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('announcements')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'announcements'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
            />
          </svg>
          <span>Announcements</span>
        </button>
      </div>

      {/* Module Tree Body - Scrollbar is ONLY inside this container */}
      {activeTab === 'modules' ? (
        <div className="flex-1 min-h-0 overflow-y-auto island-scrollbar divide-y divide-slate-100 p-1.5">
          {modules.map((module) => (
            <ModuleTreeItem
              key={module.id}
              module={module}
              isOpen={Boolean(openModuleIds[module.id])}
              onToggle={() => toggleModule(module.id)}
              selectedItemId={selectedItemId}
              onSelectContentItem={onSelectContentItem}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-sm">
          No new announcements for this batch.
        </div>
      )}
    </div>
  );
};

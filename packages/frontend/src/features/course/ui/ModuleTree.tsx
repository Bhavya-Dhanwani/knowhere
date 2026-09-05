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
  // Default first module open
  const [openModuleIds, setOpenModuleIds] = useState<Record<string, boolean>>({
    [modules[0]?.id || '']: true,
    [modules[1]?.id || '']: true
  });

  const toggleModule = (id: string) => {
    setOpenModuleIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Course Modules</h3>
        <button
          onClick={() => {
            const allOpen = modules.every((m) => openModuleIds[m.id]);
            const nextState: Record<string, boolean> = {};
            modules.forEach((m) => {
              nextState[m.id] = !allOpen;
            });
            setOpenModuleIds(nextState);
          }}
          className="text-[11px] text-primary hover:text-primary-hover font-semibold transition-colors"
        >
          Toggle All
        </button>
      </div>

      <div className="space-y-3">
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
    </div>
  );
};

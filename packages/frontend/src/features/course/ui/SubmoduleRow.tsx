import React from 'react';
import { Submodule } from '../../../shared/types';

export interface SubmoduleRowProps {
  submodule: Submodule;
  selectedItemId: string | null;
  onSelectContentItem: (itemId: string) => void;
}

export const SubmoduleRow: React.FC<SubmoduleRowProps> = ({
  submodule,
  selectedItemId,
  onSelectContentItem
}) => {
  const isCompleted = submodule.status === 'completed';
  const isInProgress = submodule.status === 'in_progress';
  const isLocked = submodule.status === 'locked';

  const totalMarks = submodule.contentItems.reduce((sum, item) => sum + (item.marks || 0), 0);

  return (
    <div
      className={`border rounded-xl p-3 transition-all duration-200 ${
        isInProgress
          ? 'bg-primary/5 border-primary/30 shadow-sm shadow-primary/5'
          : isCompleted
            ? 'bg-background/40 border-white/5 opacity-90'
            : 'bg-background/20 border-white/5 opacity-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Status icon */}
          <div className="shrink-0">
            {isCompleted ? (
              <div className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center border border-success/40">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            ) : isInProgress ? (
              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/40 animate-pulse">
                <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/5 text-muted flex items-center justify-center border border-white/10">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white truncate">{submodule.title}</h4>
            <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
              <span>{submodule.contentItems.length} items</span>
              <span>�</span>
              <span className="text-primary font-medium">+{totalMarks} pts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nested Content Items */}
      {submodule.contentItems.length > 0 && !isLocked ? (
        <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1">
          {submodule.contentItems.map((item) => {
            const isSelected = selectedItemId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectContentItem(item.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                  isSelected
                    ? 'bg-primary text-white font-medium shadow-sm shadow-primary/20'
                    : 'text-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="truncate flex items-center gap-2">
                  {item.type === 'video' ? (
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  ) : item.type === 'coding' ? (
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  )}
                  <span className="truncate">{item.title}</span>
                </span>
                <span
                  className={`text-[10px] ml-2 shrink-0 ${isSelected ? 'text-white/80' : 'text-primary'}`}
                >
                  {item.marks} pts
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

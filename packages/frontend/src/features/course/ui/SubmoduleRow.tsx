import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { Submodule } from '../../../shared/types';

export interface SubmoduleRowProps {
  submodule: Submodule;
  selectedItemId?: string | null;
  onSelectContentItem?: (itemId: string) => void;
}

export const SubmoduleRow: React.FC<SubmoduleRowProps> = ({ submodule }) => {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const activeCourseId = courseId || 'course-dsa-bootcamp';

  const handleClick = () => {
    navigate(`/course/${activeCourseId}/submodule/${submodule.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="px-3.5 py-2.5 rounded-xl hover:bg-white hover:shadow-xs border border-transparent hover:border-slate-200/80 flex items-center justify-between gap-3 cursor-pointer group transition-all select-none"
    >
      {/* Left: ↗ Arrow + Title + Badges */}
      <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
        {/* Diagonal ↗ arrow */}
        <div className="w-5 h-5 rounded-md flex items-center justify-center text-amber-600 group-hover:text-blue-600 transition-colors shrink-0">
          <svg
            className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M7 17L17 7M17 7H7M17 7V17"
            />
          </svg>
        </div>

        {/* Submodule Title */}
        <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors truncate">
          {submodule.title}
        </span>

        {/* Badges */}
        {submodule.isNew && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0">
            New
          </span>
        )}
        {submodule.status === 'completed' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
            Completed
          </span>
        )}
      </div>

      {/* Right: Deadline */}
      {submodule.deadline && (
        <div className="hidden sm:flex items-center text-xs text-slate-400 font-medium shrink-0">
          <span>Deadline: {submodule.deadline}</span>
        </div>
      )}
    </div>
  );
};

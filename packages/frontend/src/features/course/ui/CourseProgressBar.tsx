import React from 'react';

export interface CourseProgressBarProps {
  title?: string;
  onBack?: () => void;
  onManage?: () => void;
  overallProgress: number;
  totalModules: number;
  completedModules: number;
  totalSubmodules: number;
  completedSubmodules: number;
  totalScore: number;
  maxScore: number;
}

export const CourseProgressBar: React.FC<CourseProgressBarProps> = ({
  title,
  onBack,
  onManage,
  overallProgress,
  totalModules,
  completedModules,
  totalSubmodules,
  completedSubmodules,
  totalScore,
  maxScore
}) => {
  const formatScore = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(2)}k`;
    return num.toString();
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3.5 shrink-0">
      {/* Island Title & Back Arrow */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-slate-500 hover:text-slate-900 transition-colors p-1 rounded-lg hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer"
              title="Back to Dashboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
            {title || 'DSA for Bootcamp'}
          </h2>
        </div>

        {onManage && (
          <button
            type="button"
            onClick={onManage}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
            title="Open Admin Curriculum Manager"
          >
            <svg
              className="w-3.5 h-3.5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Manage (Admin)</span>
          </button>
        )}
      </div>

      {/* Percentage Complete Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-semibold text-slate-700">
          {overallProgress.toFixed(2)}% Complete
        </span>
      </div>

      {/* Progress Track & Bar */}
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs pt-0.5 text-slate-600 flex-wrap gap-2">
        <div>
          <span className="text-slate-500 font-medium">Modules: </span>
          <span className="font-bold text-slate-900">
            {completedModules}/{totalModules}
          </span>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Sub-Modules: </span>
          <span className="font-bold text-slate-900">
            {completedSubmodules}/{totalSubmodules}
          </span>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Score: </span>
          <span className="font-bold text-blue-600">
            {formatScore(totalScore)}/{formatScore(maxScore)}
          </span>
        </div>
      </div>
    </div>
  );
};

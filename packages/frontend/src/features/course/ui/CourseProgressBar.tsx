import React from 'react';
import { ProgressBar } from '../../../shared/ui/ProgressBar';

export interface CourseProgressBarProps {
  overallProgress: number;
  totalModules: number;
  completedModules: number;
  totalSubmodules: number;
  completedSubmodules: number;
  totalScore: number;
  maxScore: number;
}

export const CourseProgressBar: React.FC<CourseProgressBarProps> = ({
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
    <div className="bg-surface border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          Overall Progress
        </span>
        <span className="text-sm font-bold text-white">{overallProgress}% Complete</span>
      </div>

      <ProgressBar progress={overallProgress} height="md" />

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center">
        <div className="p-2 rounded-xl bg-background/50 border border-white/5">
          <p className="text-[10px] text-muted font-medium uppercase tracking-wider">Modules</p>
          <p className="text-sm font-bold text-white mt-0.5">
            {completedModules}/{totalModules}
          </p>
        </div>
        <div className="p-2 rounded-xl bg-background/50 border border-white/5">
          <p className="text-[10px] text-muted font-medium uppercase tracking-wider">Sub-Modules</p>
          <p className="text-sm font-bold text-white mt-0.5">
            {completedSubmodules}/{totalSubmodules}
          </p>
        </div>
        <div className="p-2 rounded-xl bg-background/50 border border-white/5">
          <p className="text-[10px] text-muted font-medium uppercase tracking-wider">Score</p>
          <p className="text-sm font-bold text-primary mt-0.5">
            {formatScore(totalScore)}/{formatScore(maxScore)}
          </p>
        </div>
      </div>
    </div>
  );
};

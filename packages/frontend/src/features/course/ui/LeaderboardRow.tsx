import React from 'react';
import { LeaderboardStudent } from '../../../shared/types';

export interface LeaderboardRowProps {
  student: LeaderboardStudent;
  isCurrentUser?: boolean;
}

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({
  student,
  isCurrentUser = false
}) => {
  const formattedPoints =
    student.points >= 1000 ? `${(student.points / 1000).toFixed(2)}k` : student.points.toString();

  return (
    <div
      className={`grid grid-cols-12 items-center py-2.5 px-3 rounded-xl text-xs transition-colors ${
        isCurrentUser
          ? 'bg-blue-50 border border-blue-200 text-blue-900 shadow-xs'
          : 'hover:bg-slate-50 text-slate-700'
      }`}
    >
      {/* NAME (left) */}
      <div className="col-span-7 flex items-center gap-2.5 min-w-0 pr-2">
        <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 text-[10px] font-bold uppercase">
          {student.avatar ? (
            <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
          ) : (
            student.name.charAt(0)
          )}
        </div>
        <span className="truncate font-semibold text-slate-900">
          {student.name} {isCurrentUser ? '(You)' : ''}
        </span>
      </div>

      {/* RANK (center) */}
      <div className="col-span-2 text-center font-medium text-slate-500">{student.rank}</div>

      {/* POINTS (right) */}
      <div className="col-span-3 text-right font-bold text-blue-600">{formattedPoints}</div>
    </div>
  );
};

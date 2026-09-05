import React from 'react';
import { Avatar } from '../../../shared/ui/Avatar';
import { LeaderboardStudent } from '../../../shared/types';

export interface LeaderboardRowProps {
  student: LeaderboardStudent;
  isCurrentUser?: boolean;
}

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({
  student,
  isCurrentUser = false
}) => {
  return (
    <div
      className={`px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-colors ${
        isCurrentUser
          ? 'bg-primary/20 border border-primary/40 shadow-sm shadow-primary/10'
          : 'bg-background/40 border border-white/5 hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-5 text-center text-xs font-bold text-muted">{student.rank}</span>
        <Avatar name={student.name} src={student.avatar} size="sm" />
        <span className="text-xs font-semibold text-white truncate max-w-[130px]">
          {student.name} {isCurrentUser ? '(You)' : ''}
        </span>
      </div>

      <span className="text-xs font-bold text-primary shrink-0 ml-2">
        {student.points.toLocaleString()} pts
      </span>
    </div>
  );
};

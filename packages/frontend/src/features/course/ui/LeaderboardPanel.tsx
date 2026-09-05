import React from 'react';
import { LeaderboardPodium } from './LeaderboardPodium';
import { LeaderboardRow } from './LeaderboardRow';
import { LeaderboardData } from '../../../shared/types';

export interface LeaderboardPanelProps {
  data: LeaderboardData;
  currentUserId?: string;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ data }) => {
  return (
    <div className="bg-surface border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <svg className="w-4 h-4 text-warning" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Batch Leaderboard
        </h3>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30">
          Live Rank
        </span>
      </div>

      {/* Top-3 Visual Podium */}
      {data.topThree?.length > 0 ? <LeaderboardPodium topThree={data.topThree} /> : null}

      {/* Ranked Table */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {data.rankings.map((student) => (
          <LeaderboardRow
            key={student.id}
            student={student}
            isCurrentUser={student.name.includes('(You)')}
          />
        ))}
      </div>

      {/* Ahead Percentile Footer Line */}
      <div className="pt-3 border-t border-white/5 text-center">
        <p className="text-xs text-muted">
          ?? You are ahead of{' '}
          <strong className="text-success font-bold">{data.aheadPercentage}%</strong> of students in
          this batch!
        </p>
      </div>
    </div>
  );
};

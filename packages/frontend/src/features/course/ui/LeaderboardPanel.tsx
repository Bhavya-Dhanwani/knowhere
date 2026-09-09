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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col h-full overflow-hidden space-y-4">
      {/* Header with Trophy Icon */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shrink-0">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-slate-900 tracking-tight">Leaderboard</h3>
      </div>

      {/* Top-3 Podium */}
      {data.topThree?.length > 0 && (
        <div className="shrink-0">
          <LeaderboardPodium topThree={data.topThree} />
        </div>
      )}

      {/* Table Header Bar */}
      <div className="bg-slate-100 rounded-lg grid grid-cols-12 px-3 py-2 text-[11px] font-bold text-slate-600 tracking-wider shrink-0">
        <span className="col-span-7">NAME</span>
        <span className="col-span-2 text-center">RANK</span>
        <span className="col-span-3 text-right">POINTS</span>
      </div>

      {/* Ranked Table - scrolls smoothly inside with island scrollbar */}
      <div className="space-y-1 flex-1 min-h-0 overflow-y-auto island-scrollbar pr-1">
        {data.rankings.map((student) => (
          <LeaderboardRow
            key={student.id}
            student={student}
            isCurrentUser={student.name.toLowerCase().includes('bhavya')}
          />
        ))}
      </div>

      {/* Ahead Percentile Footer Banner - pinned at bottom */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl py-2.5 px-4 text-center shrink-0">
        <p className="text-xs font-semibold text-blue-700">
          You are ahead of {data.aheadPercentage.toFixed(2)}% of students in this batch
        </p>
      </div>
    </div>
  );
};

import React from 'react';
import { LeaderboardStudent } from '../../../shared/types';

export interface LeaderboardPodiumProps {
  topThree: LeaderboardStudent[];
}

export const LeaderboardPodium: React.FC<LeaderboardPodiumProps> = ({ topThree }) => {
  const first = topThree.find((s) => s.rank === 1) || topThree[0];
  const second = topThree.find((s) => s.rank === 2) || topThree[1];
  const third = topThree.find((s) => s.rank === 3) || topThree[2];

  if (!first) return null;

  const formatPoints = (pts: number) => {
    return `${(pts / 1000).toFixed(2)}k`;
  };

  return (
    <div className="pt-6 pb-0 px-2 flex items-end justify-center gap-2.5">
      {/* 2nd Place (Left - Dishant) */}
      {second ? (
        <div className="flex-1 flex flex-col items-center">
          <div className="w-10 h-10 rounded-full overflow-hidden mb-1.5 border border-slate-200 bg-slate-100 shadow-xs">
            {second.avatar ? (
              <img src={second.avatar} alt={second.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xs text-white bg-amber-500">
                {second.name[0]}
              </div>
            )}
          </div>
          <p className="text-xs font-bold text-slate-800 truncate max-w-[85px] text-center mb-2">
            {second.name}
          </p>
          <div className="w-full h-24 bg-amber-100 border border-amber-200/80 rounded-t-xl flex flex-col items-center justify-center text-amber-950 shadow-xs px-1 text-center">
            <span className="font-bold text-xs text-amber-900">2nd</span>
            <span className="text-[11px] text-amber-800 font-semibold mt-0.5">
              {formatPoints(second.points)} points
            </span>
          </div>
        </div>
      ) : null}

      {/* 1st Place (Center - Bhavya) */}
      {first ? (
        <div className="flex-1 flex flex-col items-center">
          <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mb-1.5 ring-2 ring-blue-500 shadow-sm">
            {first.avatar ? (
              <img
                src={first.avatar}
                alt={first.name}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              first.name[0].toUpperCase()
            )}
          </div>
          <p className="text-xs font-bold text-slate-900 truncate max-w-[95px] text-center mb-2">
            {first.name}
          </p>
          <div className="w-full h-36 bg-blue-600 rounded-t-xl flex flex-col items-center justify-center text-white shadow-md shadow-blue-500/25 px-1 text-center">
            {/* White Trophy */}
            <svg
              className="w-5 h-5 text-white fill-current mb-1 drop-shadow-xs"
              viewBox="0 0 24 24"
            >
              <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.76 2.74 3.23 3.39V19H8v2h8v-2h-2.62v-2.67c1.47-.65 2.6-1.89 3.23-3.39C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
            </svg>
            <span className="font-bold text-xs text-white">1st</span>
            <span className="text-[11px] text-blue-100 font-semibold mt-0.5">
              {formatPoints(first.points)} points
            </span>
          </div>
        </div>
      ) : null}

      {/* 3rd Place (Right - Nihal) */}
      {third ? (
        <div className="flex-1 flex flex-col items-center">
          <div className="w-10 h-10 rounded-full overflow-hidden mb-1.5 border border-slate-200 bg-slate-100 shadow-xs">
            {third.avatar ? (
              <img src={third.avatar} alt={third.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xs text-white bg-orange-500">
                {third.name[0]}
              </div>
            )}
          </div>
          <p className="text-xs font-bold text-slate-800 truncate max-w-[85px] text-center mb-2">
            {third.name}
          </p>
          <div className="w-full h-20 bg-orange-100 border border-orange-200/80 rounded-t-xl flex flex-col items-center justify-center text-orange-950 shadow-xs px-1 text-center">
            <span className="font-bold text-xs text-orange-900">3rd</span>
            <span className="text-[11px] text-orange-800 font-semibold mt-0.5">
              {formatPoints(third.points)} points
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

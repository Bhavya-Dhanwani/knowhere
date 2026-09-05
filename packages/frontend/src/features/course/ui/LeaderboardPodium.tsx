import React from 'react';
import { Avatar } from '../../../shared/ui/Avatar';
import { LeaderboardStudent } from '../../../shared/types';

export interface LeaderboardPodiumProps {
  topThree: LeaderboardStudent[];
}

export const LeaderboardPodium: React.FC<LeaderboardPodiumProps> = ({ topThree }) => {
  const first = topThree.find((s) => s.rank === 1) || topThree[0];
  const second = topThree.find((s) => s.rank === 2) || topThree[1];
  const third = topThree.find((s) => s.rank === 3) || topThree[2];

  if (!first) return null;

  return (
    <div className="pt-6 pb-2 px-2 flex items-end justify-center gap-3">
      {/* 2nd Place (Left) */}
      {second ? (
        <div className="flex-1 flex flex-col items-center">
          <div className="relative mb-2">
            <Avatar
              name={second.name}
              src={second.avatar}
              size="lg"
              className="border-2 border-slate-400"
            />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-400 text-background text-[11px] font-black flex items-center justify-center shadow-md">
              2
            </span>
          </div>
          <p className="text-xs font-semibold text-white truncate max-w-[80px] text-center">
            {second.name}
          </p>
          <span className="text-[10px] text-primary font-bold mt-0.5">
            {second.points.toLocaleString()} pts
          </span>
          <div className="w-full h-16 bg-surface/80 border-t border-slate-400/40 rounded-t-xl mt-2 flex items-center justify-center text-slate-400 font-bold text-sm">
            2nd
          </div>
        </div>
      ) : null}

      {/* 1st Place (Center � Elevated) */}
      {first ? (
        <div className="flex-1 flex flex-col items-center -mt-4">
          <div className="relative mb-2">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-warning">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5m14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
              </svg>
            </div>
            <Avatar
              name={first.name}
              src={first.avatar}
              size="xl"
              className="border-2 border-warning shadow-lg shadow-warning/20"
            />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-warning text-background text-xs font-black flex items-center justify-center shadow-md">
              1
            </span>
          </div>
          <p className="text-xs font-bold text-white truncate max-w-[90px] text-center">
            {first.name}
          </p>
          <span className="text-[11px] text-warning font-black mt-0.5">
            {first.points.toLocaleString()} pts
          </span>
          <div className="w-full h-24 bg-primary/20 border-t-2 border-warning rounded-t-xl mt-2 flex items-center justify-center text-warning font-black text-base shadow-inner">
            1st
          </div>
        </div>
      ) : null}

      {/* 3rd Place (Right) */}
      {third ? (
        <div className="flex-1 flex flex-col items-center">
          <div className="relative mb-2">
            <Avatar
              name={third.name}
              src={third.avatar}
              size="lg"
              className="border-2 border-amber-700"
            />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-700 text-white text-[11px] font-black flex items-center justify-center shadow-md">
              3
            </span>
          </div>
          <p className="text-xs font-semibold text-white truncate max-w-[80px] text-center">
            {third.name}
          </p>
          <span className="text-[10px] text-primary font-bold mt-0.5">
            {third.points.toLocaleString()} pts
          </span>
          <div className="w-full h-12 bg-surface/80 border-t border-amber-700/40 rounded-t-xl mt-2 flex items-center justify-center text-amber-600 font-bold text-sm">
            3rd
          </div>
        </div>
      ) : null}
    </div>
  );
};

import React from 'react';
import { HeatmapDay } from '../../../shared/types';

export interface HeatmapCellProps {
  day: HeatmapDay;
}

export const HeatmapCell: React.FC<HeatmapCellProps> = ({ day }) => {
  const levelColors = {
    0: 'bg-slate-200 hover:bg-slate-300',
    1: 'bg-blue-200 hover:bg-blue-300',
    2: 'bg-blue-400 hover:bg-blue-500',
    3: 'bg-blue-500 hover:bg-blue-600',
    4: 'bg-blue-600 hover:bg-blue-700 shadow-xs'
  };

  return (
    <div
      className={`w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-[4px] transition-colors cursor-pointer group relative ${levelColors[day.level]}`}
    >
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
        <div className="bg-zinc-900 text-white text-[10px] font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap">
          {day.count} {day.count === 1 ? 'activity' : 'activities'} on {day.date}
        </div>
        <div className="w-1.5 h-1.5 bg-zinc-900 rotate-45 -mt-0.5" />
      </div>
    </div>
  );
};

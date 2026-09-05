import React from 'react';
import { HeatmapDay } from '../../../shared/types';

export interface HeatmapCellProps {
  day: HeatmapDay;
}

export const HeatmapCell: React.FC<HeatmapCellProps> = ({ day }) => {
  const levelColors = {
    0: 'bg-white/5 border border-white/5',
    1: 'bg-primary/30 border border-primary/20',
    2: 'bg-primary/50 border border-primary/40',
    3: 'bg-primary/80 border border-primary/60',
    4: 'bg-primary border border-primary shadow-sm shadow-primary/40'
  };

  return (
    <div
      className={`w-3 h-3 rounded-[3px] transition-all cursor-pointer group relative ${levelColors[day.level]}`}
    >
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
        <div className="bg-surface text-white text-[10px] font-medium px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap">
          {day.count} {day.count === 1 ? 'activity' : 'activities'} on {day.date}
        </div>
        <div className="w-1.5 h-1.5 bg-surface border-r border-b border-white/10 rotate-45 -mt-1" />
      </div>
    </div>
  );
};

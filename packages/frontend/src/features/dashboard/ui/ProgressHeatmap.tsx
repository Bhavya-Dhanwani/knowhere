import React, { useMemo } from 'react';
import { HeatmapCell } from './HeatmapCell';
import { HeatmapData, HeatmapDay } from '../../../shared/types';

export interface ProgressHeatmapProps {
  data: HeatmapData;
}

export const ProgressHeatmap: React.FC<ProgressHeatmapProps> = ({ data }) => {
  const DAYS_PER_WEEK = 7;

  // Group all days into 7-day columns
  const weeks = useMemo(() => {
    const result: HeatmapDay[][] = [];
    const days = data.days;
    for (let i = 0; i < days.length; i += DAYS_PER_WEEK) {
      result.push(days.slice(i, i + DAYS_PER_WEEK));
    }
    return result;
  }, [data.days]);

  // Display 16 weeks so it fills the container edge-to-edge
  const displayedWeeks = useMemo(() => {
    return weeks.slice(-16);
  }, [weeks]);

  return (
    <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs flex flex-col">
      {/* Title & Subtitle */}
      <div>
        <h3 className="text-base font-bold text-zinc-900 tracking-tight">Progress Heatmap</h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-blue-600 font-semibold">
            Crushed {data.totalActivities.toLocaleString()} activities so far!
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
            <button
              type="button"
              className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
            >
              Prev
            </button>
            <button
              type="button"
              className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Grid Container Box */}
      <div className="border border-zinc-200/80 bg-zinc-50/70 rounded-xl p-3.5 my-3">
        <div className="flex w-full justify-between items-center">
          {displayedWeeks.map((week, wIndex) => (
            <div key={wIndex} className="flex flex-col gap-1.5">
              {week.map((day, dIndex) => (
                <HeatmapCell key={dIndex} day={day} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Legend */}
      <div className="flex items-center justify-between text-[11px] pt-0.5">
        <button
          type="button"
          className="text-zinc-500 hover:text-zinc-800 transition-colors text-left font-normal cursor-pointer"
        >
          Learn how we count activities
        </button>

        <div className="flex items-center gap-1.5 select-none text-zinc-400">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-slate-200" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-blue-200" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-blue-400" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-blue-500" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-blue-600" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

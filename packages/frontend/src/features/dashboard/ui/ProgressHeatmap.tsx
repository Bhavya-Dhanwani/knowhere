import React, { useState, useMemo } from 'react';
import { HeatmapCell } from './HeatmapCell';
import { HeatmapData, HeatmapDay } from '../../../shared/types';

export interface ProgressHeatmapProps {
  data: HeatmapData;
}

export const ProgressHeatmap: React.FC<ProgressHeatmapProps> = ({ data }) => {
  const [page, setPage] = useState(0);
  const WEEKS_PER_PAGE = 10;
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

  const maxPages = Math.max(Math.ceil(weeks.length / WEEKS_PER_PAGE) - 1, 0);

  const displayedWeeks = useMemo(() => {
    const start = page * WEEKS_PER_PAGE;
    return weeks.slice(start, start + WEEKS_PER_PAGE);
  }, [weeks, page]);

  return (
    <div className="bg-surface border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col">
      {/* Header with Activity Count & Pagination */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Activity Heatmap</h3>
          <p className="text-xs text-primary font-medium mt-0.5">
            Crushed {data.totalActivities} activities this quarter
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            disabled={page === 0}
            className="p-1.5 rounded-lg bg-background border border-white/10 text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous weeks"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, maxPages))}
            disabled={page >= maxPages}
            className="p-1.5 rounded-lg bg-background border border-white/10 text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next weeks"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-1.5 min-w-max items-center">
          {/* Day of week labels */}
          <div className="flex flex-col gap-1.5 text-[9px] text-muted font-medium pr-1 select-none">
            <span className="h-3 flex items-center">Mon</span>
            <span className="h-3 flex items-center opacity-0">Tue</span>
            <span className="h-3 flex items-center">Wed</span>
            <span className="h-3 flex items-center opacity-0">Thu</span>
            <span className="h-3 flex items-center">Fri</span>
            <span className="h-3 flex items-center opacity-0">Sat</span>
            <span className="h-3 flex items-center opacity-0">Sun</span>
          </div>

          {/* Weeks Columns */}
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
      <div className="flex items-center justify-between text-[11px] text-muted mt-3 pt-3 border-t border-white/5">
        <span>
          Streak: <strong className="text-white font-semibold">{data.currentStreak} days</strong>
        </span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-white/5 border border-white/5" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-primary/30 border border-primary/20" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-primary/50 border border-primary/40" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-primary/80 border border-primary/60" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-primary border border-primary" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

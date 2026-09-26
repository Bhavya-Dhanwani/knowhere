import React, { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { activityGrid } from '../../../shared/lib/format';
import { cn } from '../../../shared/lib/cn';

const levels = ['bg-zinc-100', 'bg-brand-200', 'bg-brand-400', 'bg-brand-600', 'bg-brand-800'];
const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);

export const ActivityHeatmap: React.FC<{ timestamps: (string | undefined)[]; weeks?: number }> = ({
  timestamps,
  weeks = 20
}) => {
  const grid = useMemo(() => activityGrid(timestamps, weeks), [timestamps, weeks]);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900">Learning activity</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {grid.total} item{grid.total === 1 ? '' : 's'} completed in the last {weeks} weeks
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200/70">
          <Flame className="h-3.5 w-3.5" />
          {grid.streak} day streak
        </div>
      </div>

      <div className="no-scrollbar mt-4 overflow-x-auto">
        <div className="flex w-max gap-[3px]">
          {grid.columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((d) => (
                <span
                  key={d.date}
                  title={`${d.count} on ${new Date(d.date).toLocaleDateString()}`}
                  className={cn(
                    'h-[11px] w-[11px] rounded-[3px] transition-colors',
                    levels[level(d.count)]
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
        <span>Longest streak: {grid.longest}d</span>
        <span className="flex items-center gap-1">
          Less
          {levels.map((l) => (
            <span key={l} className={cn('h-[9px] w-[9px] rounded-[2px]', l)} />
          ))}
          More
        </span>
      </div>
    </div>
  );
};

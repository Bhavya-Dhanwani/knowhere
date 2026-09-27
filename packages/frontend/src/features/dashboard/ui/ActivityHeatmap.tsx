import React, { useMemo } from 'react';
import { activityGrid } from '../../../shared/lib/format';
import { cn } from '../../../shared/lib/cn';

const levels = ['bg-zinc-100', 'bg-zinc-300', 'bg-zinc-500', 'bg-zinc-700', 'bg-zinc-900'];
const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);

export const ActivityHeatmap: React.FC<{ timestamps: (string | undefined)[]; weeks?: number }> = ({
  timestamps,
  weeks = 20
}) => {
  const grid = useMemo(() => activityGrid(timestamps, weeks), [timestamps, weeks]);

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5">
      <h3 className="text-lg font-semibold tracking-tight text-zinc-900">Progress heatmap</h3>
      <p className="mt-1 text-sm text-zinc-500">
        {grid.total
          ? `Crushed ${grid.total} activit${grid.total === 1 ? 'y' : 'ies'} so far!`
          : 'Complete a lesson to start your streak.'}
      </p>

      <div className="no-scrollbar mt-4 overflow-x-auto rounded-xl border border-zinc-100 p-3">
        <div className="flex w-max gap-1">
          {grid.columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-1">
              {col.map((d) => (
                <span
                  key={d.date}
                  title={`${d.count} on ${new Date(d.date).toLocaleDateString()}`}
                  className={cn('h-3.5 w-3.5 rounded-[4px]', levels[level(d.count)])}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {grid.streak} day streak · best {grid.longest}d
        </span>
        <span className="flex items-center gap-1">
          Less
          {levels.map((l) => (
            <span key={l} className={cn('h-2.5 w-2.5 rounded-[3px]', l)} />
          ))}
          More
        </span>
      </div>
    </section>
  );
};

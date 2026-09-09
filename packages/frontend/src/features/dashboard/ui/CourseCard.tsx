import React from 'react';

export interface CourseCardProps {
  id: string;
  title: string;
  thumbnail: string;
  progress: number;
  boughtOn: string;
  discordUrl?: string;
  onResume: (courseId: string) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  id,
  title,
  thumbnail,
  progress,
  boughtOn,
  discordUrl,
  onResume
}) => {
  const formattedProgress =
    typeof progress === 'number'
      ? Number.isInteger(progress)
        ? `${progress}%`
        : `${progress.toFixed(2)}%`
      : `${progress}%`;

  return (
    <div
      onClick={() => onResume(id)}
      className="bg-white border border-zinc-200/90 hover:border-blue-300 rounded-2xl p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row gap-5 items-center shrink-0 cursor-pointer group select-none"
    >
      {/* Thumbnail */}
      <div className="w-full sm:w-56 md:w-64 h-32 shrink-0 rounded-xl overflow-hidden relative bg-zinc-900 select-none">
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
          <span className="text-white font-extrabold text-sm tracking-wider drop-shadow-md">
            {title.includes('Kodex') || title.includes('DSA') ? 'Kodex' : 'knowhere'}
          </span>
          {title.includes('C Programming') ? (
            <span className="px-1.5 py-0.5 rounded text-[11px] bg-blue-600/90 text-white font-bold">
              30+ Hrs
            </span>
          ) : null}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5 w-full">
        <div>
          {/* Title and Buttons Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 group-hover:text-blue-600 transition-colors tracking-tight leading-snug truncate">
              {title}
            </h3>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResume(id);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer whitespace-nowrap active:scale-[0.98]"
              >
                Resume Learning
              </button>

              {discordUrl ? (
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="px-4 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs flex items-center justify-center cursor-pointer whitespace-nowrap active:scale-[0.98]"
                  title="Open Discord Community"
                >
                  Open Discord
                </a>
              ) : null}
            </div>
          </div>

          {/* Meta Info */}
          <p className="text-xs text-zinc-500 mt-1 font-normal">Bought on {boughtOn}</p>
          <p className="text-xs text-zinc-700 font-semibold mt-0.5">Progress {formattedProgress}</p>
        </div>

        {/* Horizontal Progress Bar */}
        <div className="w-full mt-3.5">
          <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

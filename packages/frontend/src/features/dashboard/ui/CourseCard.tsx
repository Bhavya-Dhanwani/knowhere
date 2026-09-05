import React from 'react';
import { Button } from '../../../shared/ui/Button';
import { ProgressBar } from '../../../shared/ui/ProgressBar';

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
  return (
    <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 flex flex-col group">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-background/50">
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-80" />
        <span className="absolute top-3 left-3 bg-background/80 backdrop-blur-md text-[11px] font-medium text-muted px-2.5 py-1 rounded-md border border-white/10">
          Bought on {boughtOn}
        </span>
      </div>

      {/* Details */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-base text-white line-clamp-2 group-hover:text-primary-hover transition-colors">
            {title}
          </h3>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-muted">Progress</span>
              <span className="text-white">{progress}%</span>
            </div>
            <ProgressBar progress={progress} height="sm" />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2">
          <Button variant="primary" size="sm" className="flex-1" onClick={() => onResume(id)}>
            Resume Learning
          </Button>

          {discordUrl ? (
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-background border border-white/10 text-muted hover:text-white hover:border-primary/40 transition-colors flex items-center justify-center text-xs font-medium"
              title="Open Community Discord"
            >
              <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
};

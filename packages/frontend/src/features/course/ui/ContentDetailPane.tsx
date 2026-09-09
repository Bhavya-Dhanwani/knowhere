import React, { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Spinner } from '../../../shared/ui/Spinner';
import { ContentItemDetail } from '../../../shared/types';

export interface ContentDetailPaneProps {
  item: ContentItemDetail | null;
  isLoading: boolean;
  onComplete: (itemId: string) => void;
  isCompleting?: boolean;
}

export const ContentDetailPane: React.FC<ContentDetailPaneProps> = ({
  item,
  isLoading,
  onComplete,
  isCompleting = false
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');

  if (isLoading) {
    return (
      <div className="bg-surface border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
        <p className="text-xs text-muted mt-3">Loading lesson details...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="bg-surface border border-white/10 rounded-2xl p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-base font-bold text-white">Select a lesson to begin</h3>
        <p className="text-xs text-muted max-w-sm mt-1">
          Choose any video lecture, coding challenge, or assessment from the module outline on the
          left.
        </p>
      </div>
    );
  }

  const isCompleted = item.status === 'completed';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl flex flex-col font-sans">
      {/* Media / Code / Quiz Area */}
      <div className="relative bg-slate-950 aspect-video w-full flex items-center justify-center overflow-hidden">
        {item.type === 'video' && item.videoUrl ? (
          <video
            controls
            className="w-full h-full object-contain"
            src={item.videoUrl}
            poster="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop&q=80"
          >
            Your browser does not support HTML video playback.
          </video>
        ) : item.type === 'coding' ? (
          <div className="w-full h-full p-4 bg-[#0A0C10] font-mono text-xs flex flex-col justify-between overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-muted">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
                <span className="text-[11px] text-white/80 ml-2">solution.ts</span>
              </span>
              <span className="text-[10px] uppercase font-bold text-primary">
                TypeScript NodeNext
              </span>
            </div>
            <textarea
              value={code !== '' ? code : item.starterCode || '// Write your solution here'}
              onChange={(e) => setCode(e.target.value)}
              className="w-full flex-1 bg-transparent resize-none focus:outline-none text-emerald-400 py-3 leading-relaxed"
              spellCheck={false}
            />
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-muted">
                {code ? 'Code modified' : 'Test cases: 2/2 sample passed'}
              </span>
              <span className="text-[11px] text-primary font-bold">Reward: {item.marks} marks</span>
            </div>
          </div>
        ) : item.type === 'mcq' && item.mcqOptions ? (
          <div className="w-full h-full p-6 bg-[#0A0C10] flex flex-col justify-center max-w-xl mx-auto space-y-4">
            <span className="text-xs text-primary font-bold uppercase tracking-wider">
              Multiple Choice Assessment
            </span>
            <p className="text-sm font-semibold text-white leading-relaxed">{item.description}</p>
            <div className="space-y-2">
              {item.mcqOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedOption(opt.id)}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition-all ${
                    selectedOption === opt.id
                      ? 'bg-primary/20 border-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-surface/50 border-white/10 text-muted hover:text-white hover:bg-surface'
                  }`}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center p-8">
            <p className="text-sm text-muted">Resource document or notes</p>
          </div>
        )}
      </div>

      {/* Lesson Meta and Action Bar */}
      <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 bg-white">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {item.type}
            </span>
            {item.durationMinutes ? (
              <span className="text-xs text-slate-500">&#8226; {item.durationMinutes} mins</span>
            ) : null}
            <span className="text-xs text-amber-600 font-semibold">
              &#8226; {item.marks} Total Marks
            </span>
          </div>

          <h2 className="text-lg font-bold text-slate-900 tracking-tight truncate">{item.title}</h2>
          {item.description ? (
            <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
              {item.description}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center gap-3">
          {isCompleted ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Completed (+{item.earnedMarks || item.marks} pts awarded)
            </div>
          ) : (
            <Button
              variant="primary"
              size="md"
              isLoading={isCompleting}
              onClick={() => onComplete(item.id)}
            >
              Complete & Claim {item.marks} Pts
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

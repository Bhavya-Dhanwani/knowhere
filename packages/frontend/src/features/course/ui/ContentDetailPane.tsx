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
          <div className="w-full h-full p-4 bg-[#0A0C10] font-mono text-xs flex flex-col justify-between overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-muted shrink-0">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
                <span className="text-[11px] text-white/80 ml-2">
                  solution.
                  {item.language === 'python'
                    ? 'py'
                    : item.language === 'cpp'
                      ? 'cpp'
                      : item.language === 'java'
                        ? 'java'
                        : 'ts'}
                </span>
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-400">
                {item.language || 'TypeScript'}
              </span>
            </div>

            {item.codingPrompt && (
              <div className="py-2 px-3 my-2 bg-slate-900/90 border border-slate-800 rounded-lg text-slate-300 font-sans text-xs leading-relaxed shrink-0">
                <span className="font-bold text-white block mb-0.5">Problem Statement:</span>
                {item.codingPrompt}
              </div>
            )}

            <textarea
              value={code !== '' ? code : item.starterCode || '// Write your solution here\n'}
              onChange={(e) => setCode(e.target.value)}
              className="w-full flex-1 min-h-[140px] bg-transparent resize-none focus:outline-none text-emerald-400 py-3 leading-relaxed font-mono text-xs"
              spellCheck={false}
            />

            {item.testCases && item.testCases.length > 0 && (
              <div className="pt-2 pb-2 border-t border-white/10 space-y-1.5 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Sample Test Cases ({item.testCases.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                  {item.testCases.slice(0, 2).map((tc, i) => (
                    <div
                      key={i}
                      className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300"
                    >
                      <span className="text-slate-500 block text-[10px]">
                        Case {i + 1} {tc.isHidden ? '(Hidden)' : ''}:
                      </span>
                      <span className="text-white">In: {tc.input}</span>
                      <span className="text-emerald-400 block">Expected: {tc.output}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-white/10 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-muted">
                {code ? 'Solution drafted' : 'Ready to solve'}
              </span>
              <span className="text-[11px] text-emerald-400 font-bold">
                Reward: {item.marks} marks
              </span>
            </div>
          </div>
        ) : item.type === 'mcq' && item.mcqOptions ? (
          <div className="w-full h-full p-6 bg-[#0A0C10] flex flex-col justify-center max-w-xl mx-auto space-y-4 overflow-y-auto custom-scrollbar">
            <span className="text-xs text-purple-400 font-bold uppercase tracking-wider">
              Multiple Choice Assessment
            </span>
            <p className="text-sm font-semibold text-white leading-relaxed">
              {item.description || item.title}
            </p>
            <div className="space-y-2">
              {item.mcqOptions.map((opt) => {
                const isSelected = selectedOption === opt.id;
                const isCorrect = item.correctOptionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedOption(opt.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? isCorrect
                          ? 'bg-emerald-500/20 border-emerald-500 text-white'
                          : 'bg-purple-500/20 border-purple-500 text-white shadow-xs'
                        : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{opt.text}</span>
                    {isSelected && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500 text-white">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {item.explanation && selectedOption && (
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 text-purple-200 text-xs leading-relaxed">
                <span className="font-bold text-white block mb-0.5">Explanation:</span>
                {item.explanation}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full p-6 sm:p-8 bg-[#0F172A] text-slate-100 flex flex-col justify-between overflow-y-auto custom-scrollbar">
            <div className="space-y-4 max-w-2xl mx-auto w-full">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Lecture Notes & Reading Guide</span>
                </span>
                {item.resourceLink && (
                  <a
                    href={item.resourceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
                  >
                    <span>Open External Doc</span>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                )}
              </div>

              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                {item.description ||
                  'Review the documentation and lecture notes for this curriculum item.'}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-center shrink-0">
              <span className="text-[11px] text-slate-400">
                Review notes & resources above to complete this topic
              </span>
            </div>
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

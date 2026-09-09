import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../app/store';
import { logout } from '../../auth/state/authSlice';
import { useCourseStructure } from '../hooks/useCourseStructure';
import { useSubmoduleContent } from '../hooks/useSubmoduleContent';
import { Header } from '../../../shared/ui/Header';
import { Spinner } from '../../../shared/ui/Spinner';

export const SubmodulePage: React.FC = () => {
  const { courseId, submoduleId, lessonId } = useParams<{
    courseId: string;
    submoduleId: string;
    lessonId?: string;
  }>();

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const activeCourseId = courseId || 'course-dsa-bootcamp';
  const activeSubmoduleId = submoduleId || 'sub-dsa-intro';

  const { data: courseStructure, isLoading: isStructureLoading } =
    useCourseStructure(activeCourseId);

  // Find the active module and submodule from course structure
  let currentSubmodule = courseStructure?.modules
    ?.flatMap((m) => m.submodules)
    ?.find((s) => s.id === activeSubmoduleId);

  // Fallback if not found yet or defaults
  if (!currentSubmodule && courseStructure?.modules?.[0]?.submodules?.[1]) {
    currentSubmodule = courseStructure.modules[0].submodules[1];
  }

  // Active lesson / content item
  const [selectedItemId, setSelectedItemId] = useState<string>(
    lessonId || currentSubmodule?.contentItems?.[0]?.id || 'item-dsa-1'
  );

  useEffect(() => {
    if (lessonId) {
      setSelectedItemId(lessonId);
    } else if (currentSubmodule?.contentItems?.[0]?.id) {
      setSelectedItemId(currentSubmodule.contentItems[0].id);
    }
  }, [lessonId, currentSubmodule]);

  const { data: contentDetail } = useSubmoduleContent(selectedItemId);

  // UI States
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isAiDoubtOpen, setIsAiDoubtOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswers, setAiAnswers] = useState<Array<{ q: string; a: string }>>([
    {
      q: 'What is the core takeaway of Big-O in this lecture?',
      a: "Big-O notation describes the upper bound of an algorithm's runtime or memory growth relative to input size (N), focusing on worst-case asymptotic efficiency."
    }
  ]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Video State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const handleAskAi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;

    const q = aiQuestion.trim();
    setAiQuestion('');
    setIsAiThinking(true);

    setTimeout(() => {
      setAiAnswers((prev) => [
        ...prev,
        {
          q,
          a: `In ${currentSubmodule?.title || 'this module'}, remember that constant factors are omitted in asymptotic analysis. Focus on the dominant term as N approaches infinity!`
        }
      ]);
      setIsAiThinking(false);
    }, 900);
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
  };

  // Metrics computation for the submodule
  const totalVideos = currentSubmodule?.contentItems?.filter((i) => i.type === 'video').length || 1;
  const completedVideos =
    currentSubmodule?.contentItems?.filter((i) => i.type === 'video' && i.status === 'completed')
      .length || 1;

  const totalProblems =
    currentSubmodule?.contentItems?.filter((i) => i.type === 'coding').length || 0;
  const completedProblems =
    currentSubmodule?.contentItems?.filter((i) => i.type === 'coding' && i.status === 'completed')
      .length || 0;

  const totalMcqs = currentSubmodule?.contentItems?.filter((i) => i.type === 'mcq').length || 0;
  const completedMcqs =
    currentSubmodule?.contentItems?.filter((i) => i.type === 'mcq' && i.status === 'completed')
      .length || 0;

  const totalScore =
    currentSubmodule?.contentItems?.reduce((sum, item) => sum + (item.marks || 0), 0) || 10;
  const earnedScore =
    currentSubmodule?.contentItems?.reduce(
      (sum, item) =>
        sum + ((item as { marks?: number; earnedMarks?: number }).earnedMarks || item.marks || 0),
      0
    ) || 10;

  const currentItemIndex =
    currentSubmodule?.contentItems?.findIndex((i) => i.id === selectedItemId) ?? 0;
  const totalItemsCount = currentSubmodule?.contentItems?.length || 1;

  const handlePrevItem = () => {
    if (currentSubmodule?.contentItems && currentItemIndex > 0) {
      const prevId = currentSubmodule.contentItems[currentItemIndex - 1].id;
      setSelectedItemId(prevId);
      navigate(`/course/${activeCourseId}/submodule/${currentSubmodule.id}/lesson/${prevId}`);
    }
  };

  const handleNextItem = () => {
    if (currentSubmodule?.contentItems && currentItemIndex < totalItemsCount - 1) {
      const nextId = currentSubmodule.contentItems[currentItemIndex + 1].id;
      setSelectedItemId(nextId);
      navigate(`/course/${activeCourseId}/submodule/${currentSubmodule.id}/lesson/${nextId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header
        user={user}
        onNavigateHome={() => navigate('/dashboard')}
        onLogout={handleLogout}
        theme="light"
      />

      {/* Main 3-Column Studio Layout - Full Width */}
      <div className="flex-1 flex flex-col justify-between p-4 lg:p-6 w-full">
        {isStructureLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-28">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500 mt-4">Loading submodule...</p>
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch">
            {/* LEFT PANEL (~22% width / 3 of 12 columns): Go Back, Submodule Card, Lessons list */}
            <div className="lg:col-span-3 xl:col-span-3 flex flex-col space-y-4">
              {/* Go Back button */}
              <button
                onClick={() => navigate(`/course/${activeCourseId}`)}
                className="w-full bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 shadow-xs rounded-xl px-4 py-3 flex items-center justify-between text-sm font-semibold text-slate-800 hover:text-slate-900 transition-all group"
              >
                <span>Go Back</span>
                <span className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center text-slate-500 group-hover:text-slate-800 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 10h10a5 5 0 015 5v2m-15-7l4-4m-4 4l4 4"
                    />
                  </svg>
                </span>
              </button>

              {/* Submodule Overview Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-4 shadow-xs">
                {/* Header with Chevron < and title */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => navigate(`/course/${activeCourseId}`)}
                    className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <h2 className="text-sm font-bold text-slate-900 truncate">
                    {currentSubmodule?.title || '1 - Dsa Introduction'}
                  </h2>
                </div>

                {/* Progress Inner Box */}
                <div className="border border-slate-200 bg-slate-50 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">100.0% Complete</span>
                  </div>

                  {/* Blue Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full w-full transition-all duration-500" />
                  </div>

                  {/* 4 Metrics Row */}
                  <div className="grid grid-cols-4 gap-1 text-center pt-1">
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">Video</p>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">
                        {completedVideos}/{totalVideos}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">Problem</p>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">
                        {completedProblems}/{totalProblems}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">MCQs</p>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">
                        {completedMcqs}/{totalMcqs}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">Score</p>
                      <p className="text-xs font-bold text-blue-600 mt-0.5">
                        {earnedScore}/{totalScore}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lesson Accordion */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex-1 flex flex-col shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                    <span>Lesson</span>
                  </div>
                  <svg
                    className="w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </div>

                {/* Lesson Items */}
                <div className="space-y-2 mt-3 overflow-y-auto no-scrollbar">
                  {(
                    currentSubmodule?.contentItems || [
                      { id: 'item-dsa-1', title: 'Dsa Introduction', marks: 10 }
                    ]
                  ).map((item) => {
                    const isSelected = selectedItemId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItemId(item.id)}
                        className={`w-full px-3.5 py-3 rounded-xl flex items-center justify-between text-left transition-all ${
                          isSelected
                            ? 'bg-blue-50 border border-blue-200 shadow-xs text-blue-950 font-semibold'
                            : 'bg-transparent border border-transparent hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                          <span className="text-xs font-semibold truncate">{item.title}</span>
                        </div>
                        <span className="text-xs font-bold text-blue-600 shrink-0 ml-2">
                          {item.marks}/{item.marks}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* MIDDLE PANEL (~38% width / 4 or 5 of 12 columns): Class Notes & AI Assistant */}
            <div className="lg:col-span-4 xl:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between relative shadow-xs">
              <div className="space-y-6">
                {/* Header: (▶) Class on left, 🔖 Bookmark on right */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-sm font-bold text-blue-600">
                    <div className="w-5 h-5 rounded-full border border-blue-600 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 fill-current ml-0.5" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <span>Class</span>
                  </div>

                  <button
                    onClick={() => setIsBookmarked(!isBookmarked)}
                    className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                    title={isBookmarked ? 'Bookmarked' : 'Bookmark lesson'}
                  >
                    <svg
                      className={`w-5 h-5 ${isBookmarked ? 'fill-blue-600 text-blue-600' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                  </button>
                </div>

                {/* Lesson Title & Completed Badge */}
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {contentDetail?.title || 'Dsa Introduction'}
                  </h1>

                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                    <span>Completed</span>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                </div>

                {/* Lesson Description & Learning Objectives */}
                <div className="text-sm text-slate-600 leading-relaxed space-y-3 font-normal">
                  <p>
                    {contentDetail?.description ||
                      'Welcome to Data Structures and Algorithms! In this foundational class, we analyze time and space complexity, understand Big-O asymptotes, learn how CPU cycles and memory cache affect algorithms, and explore standard coding methodologies.'}
                  </p>

                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Key Concepts Covered
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-600 list-disc list-inside">
                      <li>Asymptotic growth rates: O(1), O(log N), O(N), O(N log N), O(N²)</li>
                      <li>Best, Average, and Worst-case runtime complexity analysis</li>
                      <li>Space complexity: Auxiliary memory vs input allocation</li>
                      <li>Why constant coefficients and lower-order terms are ignored</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Floating Action Button (AI Assistant) at Bottom-Right */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setIsAiDoubtOpen(true)}
                  className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 transition-transform hover:scale-105 active:scale-95 focus:outline-none"
                  title="Ask AI Doubt Assistant"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* RIGHT PANEL (~40% width / 5 of 12 columns): Video Lecture Player */}
            <div className="lg:col-span-5 xl:col-span-5 bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs">
              {/* Header: Video Lecture ▶ on left, Fullscreen ⛶ on right */}
              <div className="p-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span>Video Lecture</span>
                  <svg className="w-3.5 h-3.5 text-blue-600 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>

                <button
                  onClick={toggleFullscreen}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                  title="Toggle Fullscreen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                </button>
              </div>

              {/* Video Player Display */}
              <div className="flex-1 bg-slate-950 relative flex items-center justify-center min-h-[360px] overflow-hidden group">
                <video
                  ref={videoRef}
                  src={
                    contentDetail?.videoUrl ||
                    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
                  }
                  className="w-full h-full object-contain"
                  controls
                  onLoadedData={() => setIsVideoLoading(false)}
                  onWaiting={() => setIsVideoLoading(true)}
                  onPlaying={() => setIsVideoLoading(false)}
                />

                {/* Circular Gradient Spinner Ring when loading/buffering */}
                {isVideoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] pointer-events-none">
                    <div className="relative w-12 h-12">
                      <div className="w-12 h-12 rounded-full border-2 border-transparent border-t-blue-400 border-r-indigo-300 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION BAR (< Lesson 1/1 >) */}
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={handlePrevItem}
            disabled={currentItemIndex <= 0}
            className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-xs flex items-center justify-center transition-colors"
            title="Previous Lesson"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div className="px-5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-xs select-none">
            Lesson {currentItemIndex + 1}/{totalItemsCount}
          </div>

          <button
            onClick={handleNextItem}
            disabled={currentItemIndex >= totalItemsCount - 1}
            className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-xs flex items-center justify-center transition-colors"
            title="Next Lesson"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* AI Doubt Assistant Modal */}
      {isAiDoubtOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col font-sans">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-900">Knowhere AI Doubt Solver</h3>
              </div>
              <button
                onClick={() => setIsAiDoubtOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            {/* Q&A Chat History */}
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto no-scrollbar">
              {aiAnswers.map((item, idx) => (
                <div key={idx} className="space-y-1.5 text-xs">
                  <div className="bg-slate-100 p-2.5 rounded-xl text-slate-800 font-medium">
                    <span className="text-blue-600 font-bold">You: </span>
                    {item.q}
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-2.5 rounded-xl text-blue-950 leading-relaxed">
                    <span className="text-emerald-600 font-bold">AI: </span>
                    {item.a}
                  </div>
                </div>
              ))}
              {isAiThinking && (
                <div className="text-xs text-blue-600 animate-pulse flex items-center gap-2">
                  <Spinner size="sm" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>

            {/* Input form */}
            <form onSubmit={handleAskAi} className="p-4 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask any doubt about this lecture..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                Ask
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

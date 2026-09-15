import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { RootState } from '../../../app/store';
import { logout } from '../../auth/state/authSlice';
import { useCourseStructure } from '../hooks/useCourseStructure';
import { useSubmoduleContent } from '../hooks/useSubmoduleContent';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { courseApi } from '../api/courseApi';
import { Header } from '../../../shared/ui/Header';
import { Spinner } from '../../../shared/ui/Spinner';
import { CourseProgressBar } from './CourseProgressBar';
import { ModuleTree } from './ModuleTree';
import { ContentDetailPane } from './ContentDetailPane';
import { LeaderboardPanel } from './LeaderboardPanel';
import { MessageSquare } from 'lucide-react';

export const CoursePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.auth.user);

  const activeCourseId = courseId || 'course-dsa-bootcamp';

  const { data: courseStructure, isLoading: isStructureLoading } =
    useCourseStructure(activeCourseId);
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard(activeCourseId);

  const [activeModalItemId, setActiveModalItemId] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const { data: contentDetail, isLoading: isContentLoading } =
    useSubmoduleContent(activeModalItemId);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const handleComplete = async (itemId: string) => {
    try {
      setIsCompleting(true);
      await courseApi.completeContentItem(activeCourseId, itemId);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['course', activeCourseId, 'structure']
        }),
        queryClient.invalidateQueries({
          queryKey: ['content-item', itemId, 'detail']
        }),
        queryClient.invalidateQueries({
          queryKey: ['course', activeCourseId, 'leaderboard']
        })
      ]);
    } catch {
      await queryClient.invalidateQueries({
        queryKey: ['course', activeCourseId]
      });
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Light Theme Header */}
      <Header
        user={user}
        onNavigateHome={() => navigate('/dashboard')}
        onLogout={handleLogout}
        theme="light"
      />

      <div className="flex-1 flex">
        {/* Main Content Area - Full Page Natural Scroll with Hidden Scrollbar */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
          {isStructureLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Spinner size="lg" />
              <p className="text-sm text-slate-500 mt-4">Loading DSA for Bootcamp...</p>
            </div>
          ) : (
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: 2 Islands (Top Progress + Bottom Syllabus) */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
                {/* Island 1: Course Progress Card with Back Link and Title inside header */}
                {courseStructure && (
                  <CourseProgressBar
                    title={courseStructure.title}
                    onBack={() => navigate('/dashboard')}
                    onManage={() => navigate(`/admin/course/${activeCourseId}`)}
                    overallProgress={courseStructure.overallProgress}
                    totalModules={courseStructure.totalModules}
                    completedModules={courseStructure.completedModules}
                    totalSubmodules={courseStructure.totalSubmodules}
                    completedSubmodules={courseStructure.completedSubmodules}
                    totalScore={courseStructure.totalScore}
                    maxScore={courseStructure.maxScore}
                  />
                )}

                {/* Island 2: Tabs & Syllabus Accordion */}
                {courseStructure && (
                  <ModuleTree
                    modules={courseStructure.modules}
                    selectedItemId={activeModalItemId}
                    onSelectContentItem={(id) => setActiveModalItemId(id)}
                  />
                )}
              </div>

              {/* Right Column: Live Leaderboard Island */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
                {isLeaderboardLoading ? (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-8 flex flex-col items-center justify-center shadow-xs">
                    <Spinner size="md" />
                    <p className="text-xs text-slate-500 mt-2">Loading leaderboard...</p>
                  </div>
                ) : leaderboard ? (
                  <LeaderboardPanel data={leaderboard} currentUserId={user?.id} />
                ) : null}
              </div>
            </div>
          )}
        </main>

        {/* Far-Right Icon Strip */}
        <aside className="hidden md:flex w-14 bg-white border-l border-slate-200 flex-col items-center py-5 justify-between shrink-0 select-none shadow-xs">
          <div className="flex flex-col items-center gap-6">
            {/* Collapse toggle */}
            <button
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors"
              title="Toggle sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Profile / User */}
            <button
              onClick={() => navigate('/dashboard')}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors"
              title="Profile / Dashboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </button>

            {/* Certificate */}
            <button
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors"
              title="Certificates"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            </button>

            {/* Bookmark */}
            <button
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors"
              title="Saved items"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </button>

            {/* Coding / Terminal */}
            <button
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors"
              title="Compiler / Sandbox"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </button>
          </div>

          {/* Bottom Logout icon */}
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
            title="Sign Out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </aside>
      </div>

      {/* Interactive Lesson Modal / Drawer (when a submodule content item is clicked) */}
      {activeModalItemId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Top Bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Lesson Preview
                </span>
              </div>
              <button
                onClick={() => setActiveModalItemId(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-6">
              <ContentDetailPane
                item={contentDetail || null}
                isLoading={isContentLoading}
                onComplete={handleComplete}
                isCompleting={isCompleting}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

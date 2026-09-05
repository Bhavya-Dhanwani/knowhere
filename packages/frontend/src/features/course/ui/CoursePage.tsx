import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
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

export const CoursePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.auth.user);

  const activeCourseId = courseId || 'course-web-dev';

  const { data: courseStructure, isLoading: isStructureLoading } =
    useCourseStructure(activeCourseId);
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard(activeCourseId);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Set default selected content item once structure loads
  useEffect(() => {
    if (!selectedItemId && courseStructure?.modules?.length) {
      for (const mod of courseStructure.modules) {
        for (const sub of mod.submodules) {
          if (sub.contentItems?.length) {
            setSelectedItemId(sub.contentItems[0].id);
            return;
          }
        }
      }
    }
  }, [courseStructure, selectedItemId]);

  const { data: contentDetail, isLoading: isContentLoading } = useSubmoduleContent(selectedItemId);

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
      // In mock/offline mode, still invalidate to refresh UI
      await queryClient.invalidateQueries({
        queryKey: ['course', activeCourseId]
      });
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <Header user={user} onNavigateHome={() => navigate('/dashboard')} onLogout={handleLogout} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted mb-6">
          <Link
            to="/dashboard"
            className="hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-white font-medium truncate max-w-xs sm:max-w-md">
            {courseStructure?.title || 'Course View'}
          </span>
        </div>

        {isStructureLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Spinner size="lg" />
            <p className="text-sm text-muted mt-4">Loading course syllabus...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Course Header, Progress, Module Tree */}
            <div className="lg:col-span-4 xl:col-span-4 space-y-5">
              {/* Course Title Card */}
              <div className="bg-surface border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-primary/20 text-primary-hover border border-primary/30">
                    {courseStructure?.badge || 'Batch 2026'}
                  </span>
                  <span className="text-xs text-muted">
                    {courseStructure?.totalModules || 0} Modules
                  </span>
                </div>

                <h1 className="text-lg font-bold text-white leading-snug">
                  {courseStructure?.title}
                </h1>

                {courseStructure && (
                  <CourseProgressBar
                    overallProgress={courseStructure.overallProgress}
                    totalModules={courseStructure.totalModules}
                    completedModules={courseStructure.completedModules}
                    totalSubmodules={courseStructure.totalSubmodules}
                    completedSubmodules={courseStructure.completedSubmodules}
                    totalScore={courseStructure.totalScore}
                    maxScore={courseStructure.maxScore}
                  />
                )}
              </div>

              {/* Module Tree Accordion */}
              <div>
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 px-1">
                  Course Syllabus & Content
                </h2>
                {courseStructure && (
                  <ModuleTree
                    modules={courseStructure.modules}
                    selectedItemId={selectedItemId}
                    onSelectContentItem={(id) => setSelectedItemId(id)}
                  />
                )}
              </div>
            </div>

            {/* Center Column: Active Content Detail (Video / MCQ / Coding / Resource) */}
            <div className="lg:col-span-5 xl:col-span-5 space-y-4">
              <ContentDetailPane
                item={contentDetail || null}
                isLoading={isContentLoading}
                onComplete={handleComplete}
                isCompleting={isCompleting}
              />
            </div>

            {/* Right Column: Live Leaderboard */}
            <div className="lg:col-span-3 xl:col-span-3 space-y-4">
              {isLeaderboardLoading ? (
                <div className="bg-surface border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center">
                  <Spinner size="md" />
                  <p className="text-xs text-muted mt-2">Loading leaderboard...</p>
                </div>
              ) : leaderboard ? (
                <LeaderboardPanel data={leaderboard} currentUserId={user?.id} />
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

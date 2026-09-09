import React from 'react';
import { useNavigate } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../app/store';
import { logout } from '../../auth/state/authSlice';
import { useEnrolledCourses } from '../hooks/useEnrolledCourses';
import { useNotifications } from '../hooks/useNotifications';
import { useHeatmapData } from '../hooks/useHeatmapData';
import { Header } from '../../../shared/ui/Header';
import { Spinner } from '../../../shared/ui/Spinner';
import { authApi } from '../../auth/api/authApi';
import { useQueryClient } from '@tanstack/react-query';
import { CourseList } from './CourseList';
import { NotificationPanel } from './NotificationPanel';
import { ProgressHeatmap } from './ProgressHeatmap';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const queryClient = useQueryClient();

  const { data: courses, isLoading: coursesLoading } = useEnrolledCourses();
  const { data: notifications, isLoading: notifsLoading } = useNotifications();
  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmapData();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear();
      dispatch(logout());
      navigate('/');
    }
  };

  const handleResumeCourse = (courseId: string) => {
    navigate(`/course/${courseId}`);
  };

  const isLoading = coursesLoading || notifsLoading || heatmapLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} onLogout={handleLogout} onNavigateHome={() => navigate('/dashboard')} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-xs text-muted">Loading your learning workspace...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Main Content Column � Enrolled Courses */}
            <section className="lg:col-span-8">
              <CourseList courses={courses || []} onResume={handleResumeCourse} />
            </section>

            {/* Right Sidebar � Notifications & Activity Heatmap */}
            <aside className="lg:col-span-4 space-y-6">
              <NotificationPanel notifications={notifications || []} />
              {heatmapData ? <ProgressHeatmap data={heatmapData} /> : null}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};

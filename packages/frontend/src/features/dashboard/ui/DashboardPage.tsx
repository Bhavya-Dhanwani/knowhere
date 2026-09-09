import React from 'react';
import { useNavigate } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { Tv, Headphones, Shield } from 'lucide-react';
import { RootState } from '../../../app/store';
import { logout } from '../../auth/state/authSlice';
import { useEnrolledCourses } from '../hooks/useEnrolledCourses';
import { useNotifications } from '../hooks/useNotifications';
import { useHeatmapData } from '../hooks/useHeatmapData';
import { Header } from '../../../shared/ui/Header';
import { Spinner } from '../../../shared/ui/Spinner';
import { CourseList } from './CourseList';
import { NotificationPanel } from './NotificationPanel';
import { ProgressHeatmap } from './ProgressHeatmap';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const { data: courses, isLoading: coursesLoading } = useEnrolledCourses();
  const { data: notifications, isLoading: notifsLoading } = useNotifications();
  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmapData();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const handleResumeCourse = (courseId: string) => {
    navigate(`/course/${courseId}`);
  };

  const isLoading = coursesLoading || notifsLoading || heatmapLoading;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col font-sans select-none">
      <Header user={user} onLogout={handleLogout} onNavigateHome={() => navigate('/dashboard')} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-10 py-6 flex flex-col">
        {/* Top Subheader: Classroom & Quick Actions */}
        <div className="shrink-0 flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
            Classroom
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-50 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer active:scale-[0.98]"
              title="Open Administration Console"
            >
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Admin Console</span>
            </button>

            <button
              onClick={() => alert('Welcome to Knowhere! Explore your courses and progress.')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer active:scale-[0.98]"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Platform Overview</span>
            </button>

            <button
              onClick={() =>
                alert('Knowhere Support: Reach out via Discord or email support@knowhere.dev')
              }
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer active:scale-[0.98]"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Support</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
            <Spinner size="lg" />
            <p className="text-sm text-zinc-500">Loading your learning workspace...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main Content Column — Enrolled Courses */}
            <section className="lg:col-span-8 flex flex-col">
              <CourseList courses={courses || []} onResume={handleResumeCourse} />
            </section>

            {/* Right Sidebar — Notifications & Activity Heatmap */}
            <aside className="lg:col-span-4 flex flex-col gap-6">
              <div>
                <NotificationPanel notifications={notifications || []} />
              </div>
              <div>{heatmapData ? <ProgressHeatmap data={heatmapData} /> : null}</div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};

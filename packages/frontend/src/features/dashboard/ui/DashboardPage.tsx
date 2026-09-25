import React from 'react';
import { useNavigate } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { Tv, Headphones } from 'lucide-react';
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
    <div className="h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col font-sans select-none overflow-hidden">
      <Header user={user} onLogout={handleLogout} onNavigateHome={() => navigate('/dashboard')} />

      <main className="flex-1 w-full px-6 lg:px-10 2xl:px-14 py-4 lg:py-5 flex flex-col min-h-0 overflow-hidden">
        {/* Top Subheader: Classroom & Quick Actions */}
        <div className="shrink-0 flex items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
            Classroom
          </h1>

          <div className="flex items-center gap-3">
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
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 xl:grid-cols-12 2xl:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            {/* Main Content Column — Enrolled Courses (Spans full wide section) */}
            <section className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 flex flex-col min-h-0 h-full">
              <CourseList courses={courses || []} onResume={handleResumeCourse} />
            </section>

            {/* Right Sidebar — Notifications & Activity Heatmap */}
            <aside className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 flex flex-col gap-6 min-h-0 h-full overflow-y-auto custom-scrollbar pr-1 pb-2">
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

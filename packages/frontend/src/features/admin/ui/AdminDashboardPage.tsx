import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import {
  Shield,
  Plus,
  Users,
  Layers,
  Award,
  Activity,
  Search,
  BookOpen,
  Server,
  Sparkles,
  X
} from 'lucide-react';
import { RootState } from '../../../app/store';
import { logout } from '../../auth/state/authSlice';
import { Header } from '../../../shared/ui/Header';
import { Spinner } from '../../../shared/ui/Spinner';
import { adminApi, AdminCourseSummary, AdminActivityAlert } from '../api/adminApi';
import { AdminCourseCard } from './AdminCourseCard';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const [courses, setCourses] = useState<AdminCourseSummary[]>([]);
  const [alerts, setAlerts] = useState<AdminActivityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Create Course Modal state
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCategory, setNewCategory] = useState('Computer Science');
  const [newInstructor, setNewInstructor] = useState('Lead Instructor');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [coursesData, alertsData] = await Promise.all([
        adminApi.listCourses(),
        adminApi.listAlerts()
      ]);
      setCourses(coursesData);
      setAlerts(alertsData);
    } catch (err) {
      console.error('Failed to load admin dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCode.trim()) return;

    try {
      setIsSubmitting(true);
      const created = await adminApi.createCourse({
        title: newTitle,
        code: newCode,
        category: newCategory,
        instructorName: newInstructor,
        description: newDescription
      });
      setCourses((prev) => [created, ...prev]);
      setIsCreateCourseOpen(false);
      setNewTitle('');
      setNewCode('');
      setNewDescription('');
    } catch (err) {
      console.error('Failed to create course', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.instructorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalStudents = courses.reduce((acc, c) => acc + c.totalStudents, 0);
  const totalModules = courses.reduce((acc, c) => acc + c.totalModules, 0);
  const avgClassProgress =
    courses.length > 0
      ? (courses.reduce((acc, c) => acc + c.averageProgress, 0) / courses.length).toFixed(1)
      : '0.0';

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col font-sans select-none">
      {/* Light Top Navbar Matching DashboardPage */}
      <Header
        user={user}
        onLogout={handleLogout}
        onNavigateHome={() => navigate('/admin/dashboard')}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-10 py-6 flex flex-col">
        {/* Top Subheader: Admin Portal & Quick Actions */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm text-white shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
                  Administration Console
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  Admin
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Curriculum Design • Role-Based Access Control • Student Cohort Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer active:scale-[0.98]"
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
              <span>Student View</span>
            </button>

            <button
              onClick={() => navigate('/review')}
              className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Evaluation Pipeline</span>
            </button>

            <button
              onClick={() => setIsCreateCourseOpen(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Course</span>
            </button>
          </div>
        </div>

        {/* High-Level Admin Metrics Strip Matching CourseProgressBar Style */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
          <div className="flex items-center gap-3.5 pt-2 md:pt-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Managed Courses
              </span>
              <span className="text-xl font-black text-zinc-900 tracking-tight">
                {courses.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 pt-2 md:pt-0 md:pl-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Active Trainees
              </span>
              <span className="text-xl font-black text-zinc-900 tracking-tight">
                {totalStudents}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 pt-2 md:pt-0 md:pl-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Total Modules
              </span>
              <span className="text-xl font-black text-zinc-900 tracking-tight">
                {totalModules}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 pt-2 md:pt-0 md:pl-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Avg Class Progress
              </span>
              <span className="text-xl font-black text-zinc-900 tracking-tight">
                {avgClassProgress}%
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
            <Spinner size="lg" />
            <p className="text-sm text-zinc-500">Loading administrative console...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main Content Column (8 cols) — Managed Courses */}
            <section className="lg:col-span-8 flex flex-col gap-4">
              {/* Search & Filter Bar */}
              <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search courses, codes, faculty..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <span className="text-xs text-zinc-400 font-medium">Status:</span>
                  <div className="flex items-center bg-zinc-100 p-1 rounded-xl gap-1 text-xs font-semibold">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        statusFilter === 'all'
                          ? 'bg-white text-zinc-900 shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      All ({courses.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('published')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        statusFilter === 'published'
                          ? 'bg-white text-zinc-900 shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Published
                    </button>
                  </div>
                </div>
              </div>

              {/* Course Cards List */}
              <div className="space-y-4">
                {filteredCourses.length > 0 ? (
                  filteredCourses.map((c) => (
                    <AdminCourseCard
                      key={c.id}
                      course={c}
                      onManage={(id) => navigate(`/admin/course/${id}`)}
                      onPreviewStudent={(id) => navigate(`/course/${id}`)}
                    />
                  ))
                ) : (
                  <div className="bg-white border border-zinc-200/90 rounded-2xl p-12 text-center shadow-xs">
                    <Layers className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-zinc-900">
                      No courses match your criteria
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Try clearing your search query or create a new course using the action button
                      above.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Right Sidebar (4 cols) — Administrative Alerts & System Health */}
            <aside className="lg:col-span-4 flex flex-col gap-6">
              {/* Activity Feed Matching NotificationPanel */}
              <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs flex flex-col min-h-0">
                <div className="shrink-0 flex items-center justify-between mb-3">
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight">
                    Admin Notifications
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                    Live
                  </span>
                </div>

                <div className="space-y-2.5">
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl border bg-zinc-50 border-zinc-200/60 text-left hover:border-zinc-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-zinc-900 leading-snug">
                          {a.title}
                        </p>
                        <span className="text-[10px] text-zinc-400 shrink-0 whitespace-nowrap">
                          {a.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-2">
                        {a.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Status Island */}
              <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs flex flex-col">
                <h3 className="text-base font-bold text-zinc-900 tracking-tight mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-600" />
                  <span>Platform Microservices</span>
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="font-semibold text-zinc-700">Course Service</span>
                    <span className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Operational
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="font-semibold text-zinc-700">User & ARBAC Service</span>
                    <span className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Operational
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="font-semibold text-zinc-700">Project Review Engine</span>
                    <span className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Operational
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="font-semibold text-zinc-700">MCQ & Coding Runners</span>
                    <span className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Operational
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Create Course Modal */}
      {isCreateCourseOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Plus className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Create New LMS Course</h2>
              </div>
              <button
                onClick={() => setIsCreateCourseOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="p-6 space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Course Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Distributed Systems & Cloud Native Masterclass"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Course Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. DS-301"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Full-Stack Development">Full-Stack Development</option>
                    <option value="Systems Engineering">Systems Engineering</option>
                    <option value="Machine Learning">Machine Learning</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Instructor Name
                </label>
                <input
                  type="text"
                  value={newInstructor}
                  onChange={(e) => setNewInstructor(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Overview of syllabus, prerequisites, and learning outcomes..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateCourseOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Creating...' : 'Create Course'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

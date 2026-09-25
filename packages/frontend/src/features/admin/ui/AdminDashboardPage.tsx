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
  X,
  ArrowRight,
  Check,
  Image as ImageIcon
} from 'lucide-react';
import { RootState } from '../../../app/store';
import { logout } from '../../auth/state/authSlice';
import { Header } from '../../../shared/ui/Header';
import { Spinner } from '../../../shared/ui/Spinner';
import { adminApi, AdminCourseSummary, AdminActivityAlert } from '../api/adminApi';
import { AdminCourseCard } from './AdminCourseCard';

const THUMBNAIL_PRESETS = [
  {
    id: 'dsa',
    label: 'Algorithms & DSA',
    url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'systems',
    label: 'Systems & Cloud',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'web',
    label: 'Full-Stack Web',
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'ai',
    label: 'AI & Data Science',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'arch',
    label: 'Architecture',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80'
  }
];

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
  const [newStatus, setNewStatus] = useState<'published' | 'draft'>('published');
  const [selectedThumbnail, setSelectedThumbnail] = useState(
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80'
  );
  const [customThumbnailUrl, setCustomThumbnailUrl] = useState('');
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

  const handleCreateCourse = async (e: React.FormEvent, navigateToCurriculum = false) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCode.trim()) return;

    try {
      setIsSubmitting(true);
      const thumbnailToUse = customThumbnailUrl.trim() || selectedThumbnail;
      const created = await adminApi.createCourse({
        title: newTitle.trim(),
        code: newCode.trim().toUpperCase(),
        category: newCategory,
        instructorName: newInstructor.trim(),
        description: newDescription.trim(),
        thumbnail: thumbnailToUse,
        status: newStatus
      });
      setCourses((prev) => [created, ...prev]);
      setIsCreateCourseOpen(false);
      setNewTitle('');
      setNewCode('');
      setNewDescription('');
      setCustomThumbnailUrl('');

      if (navigateToCurriculum) {
        navigate(`/admin/course/${created.id}`);
      }
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
    <div className="h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col font-sans select-none overflow-hidden">
      {/* Light Top Navbar Matching DashboardPage */}
      <Header
        user={user}
        onLogout={handleLogout}
        onNavigateHome={() => navigate('/admin/dashboard')}
      />

      <main className="flex-1 w-full px-6 lg:px-10 2xl:px-14 py-4 lg:py-5 flex flex-col min-h-0 overflow-hidden">
        {/* Top Subheader: Admin Portal & Quick Actions */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
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
        <div className="shrink-0 bg-white border border-zinc-200/90 rounded-2xl p-4 lg:p-4.5 shadow-xs mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
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
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 xl:grid-cols-12 2xl:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            {/* Main Content Column (8/9 cols) — Managed Courses */}
            <section className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 flex flex-col min-h-0 h-full">
              {/* Search & Filter Bar */}
              <div className="shrink-0 bg-white border border-zinc-200/90 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 mb-3.5">
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

              {/* Course Cards List (Scrollable Area) */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 space-y-4 pb-2">
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

            {/* Right Sidebar (4/3 cols) — Administrative Alerts & System Health */}
            <aside className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 flex flex-col gap-6 min-h-0 h-full overflow-y-auto custom-scrollbar pr-1 pb-2">
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 leading-tight">
                    Create New LMS Course
                  </h2>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Configure syllabus metadata, visual branding, and curriculum workspace
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateCourseOpen(false)}
                className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={(e) => handleCreateCourse(e, true)}
              className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4.5 text-left"
            >
              {/* Title & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Course Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Distributed Systems & Cloud Infrastructure"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. CS-401"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                  />
                </div>
              </div>

              {/* Category & Instructor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Full-Stack Development">Full-Stack Development</option>
                    <option value="Systems Engineering">Systems Engineering</option>
                    <option value="Machine Learning">Machine Learning</option>
                    <option value="DevOps & Cloud">DevOps & Cloud</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Instructor Name
                  </label>
                  <input
                    type="text"
                    value={newInstructor}
                    onChange={(e) => setNewInstructor(e.target.value)}
                    placeholder="Lead Instructor"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Course Status Selection */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Initial Publication Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewStatus('published')}
                    className={`p-3 rounded-xl border text-left flex items-start justify-between cursor-pointer transition-all ${
                      newStatus === 'published'
                        ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                        : 'border-zinc-200 bg-zinc-50/60 hover:bg-zinc-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-zinc-900">Published</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Live and accessible to enrolled student cohorts
                      </p>
                    </div>
                    {newStatus === 'published' && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewStatus('draft')}
                    className={`p-3 rounded-xl border text-left flex items-start justify-between cursor-pointer transition-all ${
                      newStatus === 'draft'
                        ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                        : 'border-zinc-200 bg-zinc-50/60 hover:bg-zinc-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-xs font-bold text-zinc-900">Draft</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Authoring mode; hidden from trainees
                      </p>
                    </div>
                    {newStatus === 'draft' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Course Thumbnail Selector */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Course Thumbnail / Cover Image</span>
                </label>

                {/* Preset Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-2.5">
                  {THUMBNAIL_PRESETS.map((preset) => {
                    const isSelected = selectedThumbnail === preset.url && !customThumbnailUrl;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedThumbnail(preset.url);
                          setCustomThumbnailUrl('');
                        }}
                        className={`relative rounded-xl overflow-hidden border transition-all cursor-pointer aspect-video flex flex-col group ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/40 shadow-xs'
                            : 'border-zinc-200 hover:border-zinc-300 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-1.5">
                          <span className="text-[10px] font-semibold text-white truncate w-full text-left">
                            {preset.label}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Image URL fallback */}
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={customThumbnailUrl}
                    onChange={(e) => setCustomThumbnailUrl(e.target.value)}
                    placeholder="Or enter custom image URL (e.g. Unsplash, CDN...)"
                    className="flex-1 px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {customThumbnailUrl && (
                    <div className="w-12 h-8 rounded-lg overflow-hidden border border-zinc-200 shrink-0 bg-zinc-100">
                      <img
                        src={customThumbnailUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = selectedThumbnail;
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Course Description & Highlights
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Overview of curriculum syllabus, learning objectives, and practical assignments..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
                />
              </div>

              {/* Modal Footer with dual submit options */}
              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateCourseOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold rounded-lg border border-zinc-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting || !newTitle.trim() || !newCode.trim()}
                    onClick={(e) => handleCreateCourse(e, false)}
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-50"
                  >
                    Save Course
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newTitle.trim() || !newCode.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Creating...' : 'Create & Build Curriculum'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

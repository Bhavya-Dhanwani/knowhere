import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import {
  Shield,
  Plus,
  BookOpen,
  Users,
  Layers,
  Award,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Send,
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { RootState } from '../../../app/store';
import { logout } from '../../auth/state/authSlice';
import { Header } from '../../../shared/ui/Header';
import { Spinner } from '../../../shared/ui/Spinner';
import { useCourseStructure } from '../../course/hooks/useCourseStructure';
import { useLeaderboard } from '../../course/hooks/useLeaderboard';
import { adminApi, CourseMember } from '../api/adminApi';
import { AdminContentItemModal } from './AdminContentItemModal';
import { Module, Submodule, ContentItemSummary } from '../../../shared/types';
import { LeaderboardPodium } from '../../course/ui/LeaderboardPodium';
import { LeaderboardRow } from '../../course/ui/LeaderboardRow';

export const AdminCoursePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const activeCourseId = courseId || 'course-dsa-bootcamp';

  const { data: initialStructure, isLoading: isStructureLoading } =
    useCourseStructure(activeCourseId);
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard(activeCourseId);

  const [courseStructure, setCourseStructure] = useState(initialStructure);
  const [members, setMembers] = useState<CourseMember[]>([]);
  const [activeTab, setActiveTab] = useState<'curriculum' | 'members' | 'grades'>('curriculum');

  // Accordion state
  const [openModuleIds, setOpenModuleIds] = useState<Record<string, boolean>>({
    'mod-frontend': true,
    'mod-backend': false,
    'mod-threejs': false,
    'mod-dsa': false,
    'mod-aptitude': false
  });

  // Modal states
  const [editingItem, setEditingItem] = useState<{
    item: ContentItemSummary;
    moduleId: string;
    submoduleId: string;
    moduleTitle: string;
  } | null>(null);

  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  const [isAddSubmoduleOpen, setIsAddSubmoduleOpen] = useState<{ moduleId: string } | null>(null);
  const [newSubmoduleTitle, setNewSubmoduleTitle] = useState('');

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'trainee' | 'trainer' | 'admin'>('trainee');

  // Announcement state
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementSent, setAnnouncementSent] = useState(false);

  useEffect(() => {
    if (initialStructure) {
      setCourseStructure(initialStructure);
    }
  }, [initialStructure]);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const data = await adminApi.listMembers(activeCourseId);
        setMembers(data);
      } catch (err) {
        console.error('Failed to load course members', err);
      }
    };
    loadMembers();
  }, [activeCourseId]);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const toggleModule = (id: string) => {
    setOpenModuleIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSaveContentItem = (updated: Partial<ContentItemSummary>) => {
    if (!editingItem || !courseStructure) return;
    setCourseStructure((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modules: prev.modules.map((m) => {
          if (m.id !== editingItem.moduleId) return m;
          return {
            ...m,
            submodules: m.submodules.map((sub) => {
              if (sub.id !== editingItem.submoduleId) return sub;
              return {
                ...sub,
                contentItems: sub.contentItems.map((ci) => {
                  if (ci.id !== updated.id) return ci;
                  return { ...ci, ...updated } as ContentItemSummary;
                })
              };
            })
          };
        })
      };
    });
  };

  const handleCreateModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim() || !courseStructure) return;
    const newMod: Module = {
      id: `mod-${Date.now()}`,
      title: newModuleTitle,
      order: courseStructure.modules.length + 1,
      status: 'locked',
      submodules: []
    };
    setCourseStructure((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        totalModules: prev.totalModules + 1,
        modules: [...prev.modules, newMod]
      };
    });
    setOpenModuleIds((prev) => ({ ...prev, [newMod.id]: true }));
    setNewModuleTitle('');
    setIsAddModuleOpen(false);
  };

  const handleCreateSubmodule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddSubmoduleOpen || !newSubmoduleTitle.trim() || !courseStructure) return;
    const { moduleId } = isAddSubmoduleOpen;
    const newSub: Submodule = {
      id: `sub-${Date.now()}`,
      title: newSubmoduleTitle,
      order: 1,
      status: 'locked',
      deadline: 'April 01, 2026',
      contentItems: [
        {
          id: `ci-${Date.now()}`,
          title: `${newSubmoduleTitle} - Introduction`,
          type: 'video',
          marks: 25,
          status: 'locked',
          durationMinutes: 30
        }
      ]
    };
    setCourseStructure((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        totalSubmodules: prev.totalSubmodules + 1,
        modules: prev.modules.map((m) => {
          if (m.id !== moduleId) return m;
          return {
            ...m,
            submodules: [...m.submodules, newSub]
          };
        })
      };
    });
    setNewSubmoduleTitle('');
    setIsAddSubmoduleOpen(null);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    const created = await adminApi.assignMember(activeCourseId, {
      name: newMemberName,
      email: newMemberEmail,
      role: newMemberRole
    });
    setMembers((prev) => [created, ...prev]);
    setNewMemberName('');
    setNewMemberEmail('');
    setIsAddMemberOpen(false);
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'trainer' | 'trainee') => {
    await adminApi.updateMemberRole(activeCourseId, userId, newRole);
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)));
  };

  const handleRevokeMember = async (userId: string, name: string) => {
    if (!window.confirm(`Revoke enrollment for "${name}"?`)) return;
    await adminApi.revokeMember(activeCourseId, userId);
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const handleSendAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    setAnnouncementSent(true);
    setTimeout(() => {
      setAnnouncementText('');
      setAnnouncementSent(false);
    }, 2500);
  };

  const getItemTypeBadge = (type: string) => {
    switch (type) {
      case 'video':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            Video
          </span>
        );
      case 'coding':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            Coding
          </span>
        );
      case 'mcq':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            MCQ
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            Resource
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Light Theme Header Matching CoursePage */}
      <Header
        user={user}
        onNavigateHome={() => navigate('/admin/dashboard')}
        onLogout={handleLogout}
        theme="light"
      />

      <div className="flex-1 flex">
        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
          {isStructureLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Spinner size="lg" />
              <p className="text-sm text-slate-500 mt-4">Loading curriculum manager...</p>
            </div>
          ) : (
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column (8 cols): Island 1 (Hero Stats) + Island 2 (Curriculum / Members) */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
                {/* Island 1: Course Admin Hero Card Matching CourseProgressBar */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3.5 shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => navigate('/admin/dashboard')}
                        className="text-slate-500 hover:text-slate-900 transition-colors p-1 rounded-lg hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer"
                        title="Back to Admin Console"
                      >
                        <svg
                          className="w-4 h-4"
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
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                            {courseStructure?.title || 'DSA for Bootcamp'}
                          </h2>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            CS-204
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/course/${activeCourseId}`)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Preview Student View</span>
                      </button>

                      <button
                        onClick={() => setIsAddMemberOpen(true)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                        <span>Add Member</span>
                      </button>

                      <button
                        onClick={() => setIsAddModuleOpen(true)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-[0.98]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Module</span>
                      </button>
                    </div>
                  </div>

                  {/* Stats Row Matching CourseProgressBar */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-600 flex-wrap gap-2">
                    <div>
                      <span className="text-slate-500 font-medium">Modules: </span>
                      <span className="font-bold text-slate-900">
                        {courseStructure?.completedModules || 0}/
                        {courseStructure?.totalModules || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Sub-Modules: </span>
                      <span className="font-bold text-slate-900">
                        {courseStructure?.totalSubmodules || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Enrolled Members: </span>
                      <span className="font-bold text-slate-900">{members.length}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Max Curriculum Score: </span>
                      <span className="font-bold text-blue-600">
                        {courseStructure?.maxScore || 18280} pts
                      </span>
                    </div>
                  </div>
                </div>

                {/* Island 2: Curriculum, Members & Gradebook Tabs Matching ModuleTree */}
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col flex-1 min-h-0 overflow-hidden">
                  {/* Tabs Bar */}
                  <div className="px-5 pt-3 pb-0 border-b border-slate-100 flex items-center gap-6 shrink-0 bg-white">
                    <button
                      type="button"
                      onClick={() => setActiveTab('curriculum')}
                      className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                        activeTab === 'curriculum'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Modules & Lessons</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('members')}
                      className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                        activeTab === 'members'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Members & Roles ({members.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('grades')}
                      className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                        activeTab === 'grades'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      <span>Gradebook</span>
                    </button>
                  </div>

                  {/* TAB 1: Curriculum Management */}
                  {activeTab === 'curriculum' && (
                    <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 p-2">
                      {courseStructure?.modules.map((mod, idx) => {
                        const isOpen = Boolean(openModuleIds[mod.id]);
                        return (
                          <div key={mod.id} className="py-2">
                            {/* Module Header Row */}
                            <div
                              onClick={() => toggleModule(mod.id)}
                              className="px-4 py-3 bg-slate-50/70 hover:bg-slate-100/80 rounded-xl transition-colors flex items-center justify-between cursor-pointer group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </div>
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                    {mod.title}
                                  </h3>
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {mod.submodules?.length || 0} submodules • Status: {mod.status}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddSubmoduleOpen({ moduleId: mod.id });
                                  }}
                                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-600 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add Submodule</span>
                                </button>
                                {isOpen ? (
                                  <ChevronUp className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            </div>

                            {/* Submodules Accordion Body */}
                            {isOpen && (
                              <div className="pl-6 pr-2 pt-2 space-y-2">
                                {mod.submodules?.map((sub, sIdx) => (
                                  <div
                                    key={sub.id}
                                    className="p-3 bg-white border border-slate-200/80 rounded-xl hover:border-blue-200 transition-all space-y-2.5 shadow-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400">
                                          {idx + 1}.{sIdx + 1}
                                        </span>
                                        <span className="text-xs font-bold text-slate-900">
                                          {sub.title}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        Due: {sub.deadline || 'Flexible'}
                                      </span>
                                    </div>

                                    {/* Lessons list */}
                                    <div className="space-y-1.5 pt-1">
                                      {sub.contentItems?.map((item) => (
                                        <div
                                          key={item.id}
                                          onClick={() =>
                                            setEditingItem({
                                              item,
                                              moduleId: mod.id,
                                              submoduleId: sub.id,
                                              moduleTitle: mod.title
                                            })
                                          }
                                          className="px-3 py-2 bg-slate-50 hover:bg-blue-50/50 border border-slate-200/60 rounded-lg flex items-center justify-between cursor-pointer transition-colors group"
                                        >
                                          <div className="flex items-center gap-2.5">
                                            {getItemTypeBadge(item.type)}
                                            <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                                              {item.title}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-blue-600">
                                              {item.marks} pts
                                            </span>
                                            {item.durationMinutes && (
                                              <span className="text-[10px] text-slate-400">
                                                {item.durationMinutes}m
                                              </span>
                                            )}
                                            <Edit3 className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* TAB 2: Enrolled Members & ARBAC */}
                  {activeTab === 'members' && (
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Course Members & Role Permissions
                        </span>
                        <button
                          onClick={() => setIsAddMemberOpen(true)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Assign User</span>
                        </button>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {members.map((member) => (
                          <div
                            key={member.userId}
                            className="py-3 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                                {member.name[0].toUpperCase()}
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 leading-tight">
                                  {member.name}
                                </h4>
                                <p className="text-[11px] text-slate-500 font-mono">
                                  {member.email}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <select
                                value={member.role}
                                onChange={(e) =>
                                  handleRoleChange(member.userId, e.target.value as any)
                                }
                                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              >
                                <option value="trainee">Trainee (Student)</option>
                                <option value="trainer">Trainer (Instructor)</option>
                                <option value="admin">Course Admin</option>
                              </select>

                              <button
                                onClick={() => handleRevokeMember(member.userId, member.name)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Revoke from course"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Gradebook & Progress */}
                  {activeTab === 'grades' && (
                    <div className="flex-1 min-h-0 overflow-y-auto p-4">
                      <table className="w-full text-left text-xs font-sans">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3 rounded-l-lg">Student</th>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3">Progress</th>
                            <th className="py-2.5 px-3 text-right rounded-r-lg">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {members.map((m) => (
                            <tr key={m.userId} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-3">
                                <span className="font-bold text-slate-900 block">{m.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {m.email}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-700">
                                  {m.role}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-blue-600 h-full rounded-full"
                                      style={{ width: `${m.progressPercent}%` }}
                                    />
                                  </div>
                                  <span className="font-semibold text-slate-700">
                                    {m.progressPercent}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-blue-600">
                                {m.points} pts
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (4 cols): Island 3 (Class Leaderboard & Announcement) Matching LeaderboardPanel */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
                {/* Live Leaderboard */}
                {isLeaderboardLoading ? (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-8 flex flex-col items-center justify-center shadow-xs">
                    <Spinner size="md" />
                    <p className="text-xs text-slate-500 mt-2">Loading standings...</p>
                  </div>
                ) : leaderboard ? (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col overflow-hidden space-y-4">
                    <div className="flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shrink-0">
                          <Award className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                          Class Standings
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Active Batch
                      </span>
                    </div>

                    {/* Top 3 Podium */}
                    {leaderboard.topThree?.length > 0 && (
                      <div className="shrink-0">
                        <LeaderboardPodium topThree={leaderboard.topThree} />
                      </div>
                    )}

                    {/* Table Header Bar */}
                    <div className="bg-slate-100 rounded-lg grid grid-cols-12 px-3 py-2 text-[11px] font-bold text-slate-600 tracking-wider shrink-0">
                      <span className="col-span-7">NAME</span>
                      <span className="col-span-2 text-center">RANK</span>
                      <span className="col-span-3 text-right">POINTS</span>
                    </div>

                    {/* Ranked Table */}
                    <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                      {leaderboard.rankings.map((student) => (
                        <LeaderboardRow key={student.id} student={student} isCurrentUser={false} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Broadcast Announcement Card */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">Broadcast Announcement</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Send an instant notification alert to all trainees enrolled in this cohort.
                  </p>
                  <form onSubmit={handleSendAnnouncement} className="space-y-2.5">
                    <textarea
                      rows={2}
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="e.g. Live mentor session begins at 6:00 PM IST..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!announcementText.trim() || announcementSent}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {announcementSent ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Broadcast Sent!</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Announcement</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Far-Right Icon Strip Matching CoursePage */}
        <aside className="hidden md:flex w-14 bg-white border-l border-slate-200 flex-col items-center py-5 justify-between shrink-0 select-none shadow-xs">
          <div className="flex flex-col items-center gap-6">
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

            <button
              onClick={() => navigate('/admin/dashboard')}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors"
              title="Admin Dashboard"
            >
              <Shield className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab('curriculum')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === 'curriculum'
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
              }`}
              title="Curriculum Editor"
            >
              <Layers className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === 'members'
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
              }`}
              title="Members & Roles"
            >
              <Users className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigate('/review')}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors"
              title="Project Review Engine"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
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

      {/* Admin Content Item Modal */}
      {editingItem && (
        <AdminContentItemModal
          isOpen={Boolean(editingItem)}
          item={editingItem.item}
          moduleTitle={editingItem.moduleTitle}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveContentItem}
        />
      )}

      {/* Add Module Modal */}
      {isAddModuleOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add New Module</h3>
              <button
                onClick={() => setIsAddModuleOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateModule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Module Title
                </label>
                <input
                  type="text"
                  required
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  placeholder="e.g. Graph Algorithms & Dynamic Programming"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModuleOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Create Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Submodule Modal */}
      {isAddSubmoduleOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Submodule</h3>
              <button
                onClick={() => setIsAddSubmoduleOpen(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmodule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Submodule Title
                </label>
                <input
                  type="text"
                  required
                  value={newSubmoduleTitle}
                  onChange={(e) => setNewSubmoduleTitle(e.target.value)}
                  placeholder="e.g. Dijkstra's Algorithm & Priority Queues"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSubmoduleOpen(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Add Submodule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Enroll Course Member</h3>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Ananya Sen"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="ananya@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Course Role
                </label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="trainee">Trainee (Learner)</option>
                  <option value="trainer">Trainer (Instructor)</option>
                  <option value="admin">Course Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Enroll Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

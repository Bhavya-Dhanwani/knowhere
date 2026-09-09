import React from 'react';
import { Users, Layers, Settings, BookOpen } from 'lucide-react';
import { AdminCourseSummary } from '../api/adminApi';

export interface AdminCourseCardProps {
  course: AdminCourseSummary;
  onManage: (courseId: string) => void;
  onPreviewStudent: (courseId: string) => void;
}

export const AdminCourseCard: React.FC<AdminCourseCardProps> = ({
  course,
  onManage,
  onPreviewStudent
}) => {
  const formattedProgress =
    typeof course.averageProgress === 'number'
      ? Number.isInteger(course.averageProgress)
        ? `${course.averageProgress}%`
        : `${course.averageProgress.toFixed(1)}%`
      : `${course.averageProgress}%`;

  return (
    <div
      onClick={() => onManage(course.id)}
      className="bg-white border border-zinc-200/90 hover:border-blue-300 rounded-2xl p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row gap-5 items-center shrink-0 cursor-pointer group select-none"
    >
      {/* Thumbnail Matching Student CourseCard */}
      <div className="w-full sm:w-56 md:w-64 h-32 shrink-0 rounded-xl overflow-hidden relative bg-zinc-900 select-none">
        <img
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        <div className="absolute top-2.5 left-3 pointer-events-none">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-white/90 text-zinc-900 shadow-xs">
            {course.code}
          </span>
        </div>

        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
          <span className="text-white font-extrabold text-sm tracking-wider drop-shadow-md">
            {course.title.includes('Kodex') || course.title.includes('DSA') ? 'Kodex' : 'knowhere'}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-600/90 text-white font-bold uppercase tracking-wider">
            {course.status}
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5 w-full">
        <div>
          {/* Title and Buttons Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 group-hover:text-blue-600 transition-colors tracking-tight leading-snug truncate">
                  {course.title}
                </h3>
                <span className="hidden md:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {course.category}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 font-normal">
                Instructor: {course.instructorName} • Created on {course.createdAt}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewStudent(course.id);
                }}
                className="px-3 py-2 rounded-lg bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.98]"
                title="Preview as Student"
              >
                <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                <span>Student View</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onManage(course.id);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.98]"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Manage Course</span>
              </button>
            </div>
          </div>

          {/* Stats Bar & Progress Track */}
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-600 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-semibold text-zinc-900">{course.totalStudents}</span>
              <span className="text-zinc-500">enrolled</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-semibold text-zinc-900">{course.totalModules}</span>
              <span className="text-zinc-500">modules ({course.totalSubmodules} submodules)</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-zinc-500">Avg Class Progress:</span>
              <span className="font-bold text-zinc-900">{formattedProgress}</span>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden mt-2">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, course.averageProgress))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

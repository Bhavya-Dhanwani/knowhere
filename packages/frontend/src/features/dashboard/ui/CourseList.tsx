import React, { useState, useMemo } from 'react';
import { CourseCard } from './CourseCard';
import { EnrolledCourse } from '../../../shared/types';

export interface CourseListProps {
  courses: EnrolledCourse[];
  onResume: (courseId: string) => void;
}

export const CourseList: React.FC<CourseListProps> = ({ courses, onResume }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'oldest' | 'newest' | 'progress'>('oldest');

  const filteredCourses = useMemo(() => {
    return courses
      .filter((c) => c.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'progress') return b.progress - a.progress;
        if (sortBy === 'newest') return b.id.localeCompare(a.id);
        // default: oldest
        return a.id.localeCompare(b.id);
      });
  }, [courses, searchTerm, sortBy]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Header and Controls */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-1">
        <h2 className="text-lg sm:text-xl font-bold text-zinc-900 tracking-tight">
          Your Enrolled Courses
        </h2>

        <div className="flex items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <svg
              className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 w-44 sm:w-60 transition-all shadow-xs"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'oldest' | 'newest' | 'progress')}
              className="appearance-none pl-3 pr-7 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 focus:outline-none focus:border-blue-500 transition-all cursor-pointer shadow-xs"
            >
              <option value="oldest">Sort By Oldest ⇅</option>
              <option value="newest">Sort By Newest ⇅</option>
              <option value="progress">Highest Progress ⇅</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Course List Stack (Scrollable Area) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-2 space-y-3.5">
        {filteredCourses.length > 0 ? (
          filteredCourses.map((course) => (
            <CourseCard key={course.id} {...course} onResume={onResume} />
          ))
        ) : (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center shadow-xs">
            <p className="text-sm text-zinc-500">No matching enrolled courses found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

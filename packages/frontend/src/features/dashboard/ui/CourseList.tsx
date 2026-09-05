import React, { useState, useMemo } from 'react';
import { CourseCard } from './CourseCard';
import { EnrolledCourse } from '../../../shared/types';

export interface CourseListProps {
  courses: EnrolledCourse[];
  onResume: (courseId: string) => void;
}

export const CourseList: React.FC<CourseListProps> = ({ courses, onResume }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'progress' | 'recent'>('recent');

  const filteredCourses = useMemo(() => {
    return courses
      .filter((c) => c.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'progress') return b.progress - a.progress;
        return 0;
      });
  }, [courses, searchTerm, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Your Enrolled Courses</h2>
          <p className="text-xs text-muted mt-1">Pick up right where you left off</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <svg
              className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
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
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-surface border border-white/10 rounded-lg text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-primary w-48 sm:w-60 transition-all"
            />
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'progress' | 'recent')}
            className="px-3 py-1.5 bg-surface border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary transition-all cursor-pointer"
          >
            <option value="recent">Recently Bought</option>
            <option value="progress">Highest Progress</option>
          </select>
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} {...course} onResume={onResume} />
          ))}
        </div>
      ) : (
        <div className="bg-surface/50 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-sm text-muted">No matching enrolled courses found.</p>
        </div>
      )}
    </div>
  );
};

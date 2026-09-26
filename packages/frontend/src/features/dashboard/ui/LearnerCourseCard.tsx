import React from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowUpRight, Layers } from 'lucide-react';
import { CourseCover } from '../../../shared/ui/CourseCover';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { Badge } from '../../../shared/ui/Badge';
import { Course, CourseProgress } from '../../../shared/api/lms';

export const LearnerCourseCard: React.FC<{
  course: Course;
  progress?: CourseProgress;
  index?: number;
  cta?: string;
}> = ({ course, progress, index = 0, cta = 'Continue' }) => {
  const pct = progress?.percentage ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link
        to={`/course/${course.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-lift"
      >
        <CourseCover seed={course.id} title={course.title} className="aspect-[16/7] w-full" />
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 min-w-0 text-[15px] font-semibold leading-snug text-zinc-900">
              {course.title}
            </h3>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-900" />
          </div>
          {course.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
              {course.description}
            </p>
          ) : null}

          <div className="mt-auto pt-4">
            {progress ? (
              <>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">
                    {progress.completedItemsCount} item
                    {progress.completedItemsCount === 1 ? '' : 's'} done
                  </span>
                  <span className="font-medium tabular-nums text-zinc-900">{Math.round(pct)}%</span>
                </div>
                <ProgressBar value={pct} height="sm" />
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" /> {course.moduleCount} module
                  {course.moduleCount === 1 ? '' : 's'}
                </span>
                {course.status !== 'published' ? (
                  <Badge variant="gray" size="sm">
                    {course.status}
                  </Badge>
                ) : null}
              </div>
            )}
            <span className="mt-3 inline-flex text-xs font-medium text-brand-700">{cta} →</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

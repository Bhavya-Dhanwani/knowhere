import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../shared/ui/Modal';
import { Input } from '../../../shared/ui/Input';
import { Button } from '../../../shared/ui/Button';
import { FormError } from '../../auth/ui/AuthControls';
import { lmsApi, Course, CourseStatus } from '../../../shared/api/lms';
import { cn } from '../../../shared/lib/cn';

export const CreateCourseModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated?: (course: Course) => void;
}> = ({ open, onClose, onCreated }) => {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CourseStatus>('draft');

  const m = useMutation({
    mutationFn: () =>
      lmsApi.createCourse({
        title: title.trim(),
        description: description.trim(),
        status
      }),
    onSuccess: (course) => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      onCreated?.(course);
      setTitle('');
      setDescription('');
      setStatus('draft');
      onClose();
    }
  });

  const valid = title.trim().length >= 3;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="New course"
      description="Start empty — attach modules from your content library afterwards."
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="create-course" type="submit" disabled={!valid} isLoading={m.isPending}>
            Create course
          </Button>
        </>
      }
    >
      <form
        id="create-course"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) m.mutate();
        }}
      >
        <FormError message={m.error instanceof Error ? m.error.message : null} />
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Distributed Systems Bootcamp"
          autoFocus
          required
        />
        <div>
          <label
            htmlFor="course-desc"
            className="mb-1.5 block text-[13px] font-medium text-zinc-700"
          >
            Description
          </label>
          <textarea
            id="course-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What will learners be able to do by the end?"
            className="w-full resize-none rounded-xl bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-xs ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-zinc-700">Visibility</legend>
          <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
            {(['draft', 'published'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={cn(
                  'rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition',
                  status === s
                    ? 'bg-brand-50/60 ring-2 ring-brand-500'
                    : 'ring-zinc-200 hover:ring-zinc-300'
                )}
              >
                <span className="block text-sm font-medium capitalize text-zinc-900">{s}</span>
                <span className="block text-xs text-zinc-500">
                  {s === 'draft' ? 'Only staff can see it' : 'Visible to learners'}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
};

import React, { useState } from 'react';
import { X, Hash, GraduationCap } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    type: 'public' | 'course' | 'private_group';
    courseId?: string;
  }) => Promise<void>;
  courseId?: string;
}

export const CreateChannelModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, courseId }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'public' | 'course' | 'private_group'>(
    courseId ? 'course' : 'public'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        type,
        courseId: type === 'course' ? courseId : undefined
      });
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to create channel');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-white">Create Channel</h3>
            <p className="text-xs text-zinc-400">in LMS Community</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-950/60 border border-red-800/80 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Channel Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Channel Type
            </label>
            <div className="space-y-2">
              <label
                onClick={() => setType('public')}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  type === 'public'
                    ? 'bg-zinc-800 border-indigo-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <Hash className="w-5 h-5 text-zinc-400" />
                <div className="text-left">
                  <div className="text-sm font-medium">Text Channel</div>
                  <div className="text-xs text-zinc-400">
                    Post messages, code snippets, and study materials
                  </div>
                </div>
              </label>

              {courseId && (
                <label
                  onClick={() => setType('course')}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    type === 'course'
                      ? 'bg-zinc-800 border-indigo-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <GraduationCap className="w-5 h-5 text-indigo-400" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Course Discussion</div>
                    <div className="text-xs text-zinc-400">
                      Linked directly to this course syllabus
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Channel Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Channel Name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-400">#</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="new-channel"
                required
                className="w-full pl-7 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Topic / Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Channel Topic (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              rows={2}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              {isSubmitting ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Save, Video, Code2, CheckSquare, FileText } from 'lucide-react';
import { ContentItemSummary } from '../../../shared/types';

export interface AdminContentItemModalProps {
  isOpen: boolean;
  item: ContentItemSummary | null;
  moduleTitle: string;
  onClose: () => void;
  onSave: (updatedItem: Partial<ContentItemSummary>) => void;
}

export const AdminContentItemModal: React.FC<AdminContentItemModalProps> = ({
  isOpen,
  item,
  moduleTitle,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'video' | 'coding' | 'mcq' | 'resource'>('video');
  const [marks, setMarks] = useState(30);
  const [durationMinutes, setDurationMinutes] = useState(40);
  const [description, setDescription] = useState('');
  const [resourceLink, setResourceLink] = useState('');

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setType(item.type);
      setMarks(item.marks);
      setDurationMinutes(item.durationMinutes || 30);
      setDescription(
        item.type === 'video'
          ? 'Comprehensive lecture covering foundational architecture, best practices, and code patterns.'
          : item.type === 'coding'
            ? 'Hands-on coding exercise. Implement the functions according to the problem specification.'
            : 'Multiple-choice conceptual evaluation.'
      );
      setResourceLink('https://knowhere.dev/resources/docs');
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: item.id,
      title,
      type,
      marks: Number(marks),
      durationMinutes: Number(durationMinutes)
    });
    onClose();
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4 text-blue-600" />;
      case 'coding':
        return <Code2 className="w-4 h-4 text-emerald-600" />;
      case 'mcq':
        return <CheckSquare className="w-4 h-4 text-purple-600" />;
      default:
        return <FileText className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Top Bar Matching CoursePage */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
              {getTypeIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Curriculum Editor
                </span>
                <span className="text-xs text-slate-400 font-medium">in {moduleTitle}</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                Edit Content Item: {item.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Lesson Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="e.g. Responsive Web Design & Box Model"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Content Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="video">Video Lecture</option>
                <option value="coding">Coding Challenge</option>
                <option value="mcq">MCQ Quiz</option>
                <option value="resource">Reference Resource</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                XP / Marks
              </label>
              <input
                type="number"
                min="0"
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Est. Duration (Mins)
              </label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Instructional Guide / Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all leading-relaxed"
              placeholder="Provide context, learning objectives, and prerequisites..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {type === 'video' ? 'Video Stream URL (HLS / MP4)' : 'Reference / Documentation URL'}
            </label>
            <input
              type="text"
              value={resourceLink}
              onChange={(e) => setResourceLink(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="https://..."
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">
              ID: <code className="font-mono text-slate-600">{item.id}</code>
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

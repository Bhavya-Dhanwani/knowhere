import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Video,
  Code2,
  CheckSquare,
  FileText,
  Plus,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Clock,
  Award,
  Link as LinkIcon
} from 'lucide-react';
import { ContentItemDetail, ContentItemSummary, ContentItemType } from '../../../shared/types';
import { courseApi } from '../../course/api/courseApi';

export interface AdminContentItemModalProps {
  isOpen: boolean;
  item: ContentItemSummary | null; // If null, create mode
  initialType?: ContentItemType;
  moduleId: string;
  submoduleId: string;
  moduleTitle: string;
  submoduleTitle: string;
  onClose: () => void;
  onSave: (savedItem: ContentItemDetail, isNew: boolean) => void;
}

export const AdminContentItemModal: React.FC<AdminContentItemModalProps> = ({
  isOpen,
  item,
  initialType = 'video',
  moduleTitle,
  submoduleTitle,
  onClose,
  onSave
}) => {
  const isNew = !item;

  // Basic Information
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ContentItemType>(initialType);
  const [marks, setMarks] = useState(30);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [description, setDescription] = useState('');

  // Video Specific
  const [videoUrl, setVideoUrl] = useState('');

  // MCQ Specific
  const [mcqQuestion, setMcqQuestion] = useState('');
  const [mcqOptions, setMcqOptions] = useState<Array<{ id: string; text: string }>>([
    { id: 'opt-1', text: '' },
    { id: 'opt-2', text: '' },
    { id: 'opt-3', text: '' },
    { id: 'opt-4', text: '' }
  ]);
  const [correctOptionId, setCorrectOptionId] = useState('opt-1');
  const [explanation, setExplanation] = useState('');

  // Coding Specific
  const [codingPrompt, setCodingPrompt] = useState('');
  const [starterCode, setStarterCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [timeLimitMs, setTimeLimitMs] = useState(1000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(256);
  const [testCases, setTestCases] = useState<
    Array<{ input: string; output: string; isHidden?: boolean }>
  >([
    { input: 'nums = [2,7,11,15], target = 9', output: '[0, 1]', isHidden: false },
    { input: 'nums = [3,2,4], target = 6', output: '[1, 2]', isHidden: true }
  ]);

  // Resource Specific
  const [resourceLink, setResourceLink] = useState('');

  // Populate data if editing an existing item
  useEffect(() => {
    if (!isOpen) return;

    if (item) {
      setTitle(item.title);
      setType(item.type);
      setMarks(item.marks || 30);
      setDurationMinutes(item.durationMinutes || 30);

      courseApi
        .getSubmoduleContent(item.id)
        .then((detail) => {
          setDescription(detail.description || '');
          setVideoUrl(detail.videoUrl || '');
          setCodingPrompt(detail.codingPrompt || detail.description || '');
          setStarterCode(detail.starterCode || '');
          setLanguage(detail.language || 'python');
          if (detail.mcqOptions && detail.mcqOptions.length > 0) {
            setMcqOptions(detail.mcqOptions);
            setCorrectOptionId(detail.correctOptionId || detail.mcqOptions[0].id);
          }
          if (detail.testCases && detail.testCases.length > 0) {
            setTestCases(detail.testCases);
          }
          setResourceLink(detail.resourceLink || '');
          setExplanation(detail.explanation || '');
        })
        .catch(() => {
          setDescription(
            'Comprehensive learning module covering theoretical concepts and practical patterns.'
          );
        });
    } else {
      // New Item Defaults
      setType(initialType);
      setTitle('');
      setMarks(initialType === 'coding' ? 100 : initialType === 'mcq' ? 20 : 30);
      setDurationMinutes(initialType === 'video' ? 35 : initialType === 'coding' ? 60 : 15);
      setDescription('');
      setVideoUrl(
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      );
      setMcqQuestion('');
      setMcqOptions([
        { id: 'opt-1', text: 'Option A' },
        { id: 'opt-2', text: 'Option B' },
        { id: 'opt-3', text: 'Option C' },
        { id: 'opt-4', text: 'Option D' }
      ]);
      setCorrectOptionId('opt-1');
      setExplanation('');
      setCodingPrompt(
        'Given an integer array nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.'
      );
      setStarterCode(
        'def solution(nums: list[int], target: int) -> list[int]:\n    # Write your solution here\n    pass\n'
      );
      setLanguage('python');
      setTestCases([
        { input: '[2, 7, 11, 15], 9', output: '[0, 1]', isHidden: false },
        { input: '[3, 2, 4], 6', output: '[1, 2]', isHidden: true }
      ]);
      setResourceLink('https://knowhere.dev/docs/curriculum');
    }
  }, [isOpen, item, initialType]);

  if (!isOpen) return null;

  // MCQ Handlers
  const handleAddOption = () => {
    const newId = `opt-${Date.now()}-${mcqOptions.length + 1}`;
    setMcqOptions((prev) => [...prev, { id: newId, text: '' }]);
  };

  const handleUpdateOption = (id: string, text: string) => {
    setMcqOptions((prev) => prev.map((opt) => (opt.id === id ? { ...opt, text } : opt)));
  };

  const handleRemoveOption = (id: string) => {
    if (mcqOptions.length <= 2) return;
    setMcqOptions((prev) => prev.filter((opt) => opt.id !== id));
    if (correctOptionId === id) {
      setCorrectOptionId(mcqOptions.find((o) => o.id !== id)?.id || '');
    }
  };

  // Test Case Handlers
  const handleAddTestCase = () => {
    setTestCases((prev) => [...prev, { input: '', output: '', isHidden: false }]);
  };

  const handleUpdateTestCase = (
    index: number,
    field: 'input' | 'output' | 'isHidden',
    value: any
  ) => {
    setTestCases((prev) => prev.map((tc, idx) => (idx === index ? { ...tc, [field]: value } : tc)));
  };

  const handleRemoveTestCase = (index: number) => {
    if (testCases.length <= 1) return;
    setTestCases((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const itemId = item?.id || `ci-${Date.now()}`;

    const savedDetail: ContentItemDetail = {
      id: itemId,
      title: title.trim(),
      type,
      marks: Number(marks),
      status: item?.status || 'locked',
      durationMinutes: Number(durationMinutes),
      description: description.trim(),
      videoUrl: type === 'video' ? videoUrl.trim() : undefined,
      mcqOptions: type === 'mcq' ? mcqOptions : undefined,
      correctOptionId: type === 'mcq' ? correctOptionId : undefined,
      explanation: type === 'mcq' ? explanation.trim() : undefined,
      codingPrompt: type === 'coding' ? codingPrompt.trim() : undefined,
      starterCode: type === 'coding' ? starterCode : undefined,
      language: type === 'coding' ? language : undefined,
      testCases: type === 'coding' ? testCases : undefined,
      timeLimitMs: type === 'coding' ? Number(timeLimitMs) : undefined,
      memoryLimitMb: type === 'coding' ? Number(memoryLimitMb) : undefined,
      resourceLink: type === 'resource' ? resourceLink.trim() : undefined
    };

    // Save in API store
    courseApi.saveContentItemDetail(savedDetail);

    onSave(savedDetail, isNew);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                type === 'video'
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : type === 'mcq'
                    ? 'bg-purple-50 border-purple-200 text-purple-600'
                    : type === 'coding'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      : 'bg-amber-50 border-amber-200 text-amber-600'
              }`}
            >
              {type === 'video' && <Video className="w-4 h-4" />}
              {type === 'mcq' && <CheckSquare className="w-4 h-4" />}
              {type === 'coding' && <Code2 className="w-4 h-4" />}
              {type === 'resource' && <FileText className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {isNew ? 'New Curriculum Item' : 'Curriculum Studio'}
                </span>
                <span className="text-xs text-slate-400 font-medium truncate max-w-xs">
                  {moduleTitle} • {submoduleTitle}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
                {isNew ? `Add New ${type.toUpperCase()}` : `Edit: ${item.title}`}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Type Selector Switcher Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setType('video')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              type === 'video'
                ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-blue-600" />
            <span>Video Lecture</span>
          </button>

          <button
            type="button"
            onClick={() => setType('mcq')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              type === 'mcq'
                ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
            <span>MCQ Assessment</span>
          </button>

          <button
            type="button"
            onClick={() => setType('coding')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              type === 'coding'
                ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Coding Problem</span>
          </button>

          <button
            type="button"
            onClick={() => setType('resource')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              type === 'resource'
                ? 'bg-white text-amber-700 shadow-xs border border-amber-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>Notes & Resource</span>
          </button>
        </div>

        {/* Modal Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-5 text-left"
        >
          {/* Universal Header Row: Title, XP, Duration */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Item Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                placeholder={
                  type === 'video'
                    ? 'e.g. Asymptotic Notation & Amortized Complexity'
                    : type === 'mcq'
                      ? 'e.g. Master Theorem & Binary Tree Traversal Evaluation'
                      : type === 'coding'
                        ? 'e.g. Two Sum & Hash Map Index Lookup'
                        : 'e.g. Official Documentation & Architecture Reference'
                }
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  XP / Marks
                </label>
                <div className="relative">
                  <Award className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="0"
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Est. Duration (Mins)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="1"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Access Level
                </label>
                <div className="px-3 py-2 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Enrolled Cohort</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* TYPE SPECIFIC FIELDS: VIDEO LECTURE */}
          {/* ======================================================== */}
          {type === 'video' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Video Stream URL (MP4, HLS, or YouTube Embed){' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    required
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports direct MP4/HLS streams or hosted URLs. Will load in the classroom video
                  player.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lecture Overview & Learning Objectives
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Outline key concepts, timestamps, and theoretical takeaways covered in this lecture..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TYPE SPECIFIC FIELDS: MCQ ASSESSMENT */}
          {/* ======================================================== */}
          {type === 'mcq' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Question Prompt / Problem Statement <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={mcqQuestion || description}
                  onChange={(e) => {
                    setMcqQuestion(e.target.value);
                    setDescription(e.target.value);
                  }}
                  placeholder="e.g. Which of the following algorithmic paradigms does Dijkstra's Algorithm utilize?"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 leading-relaxed"
                />
              </div>

              {/* Options Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Answer Options (Select the correct radio choice)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Option</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {mcqOptions.map((opt, index) => {
                    const isCorrect = correctOptionId === opt.id;
                    const letter = String.fromCharCode(65 + index);
                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                          isCorrect
                            ? 'bg-purple-50/60 border-purple-300 ring-1 ring-purple-400'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* Radio for Correct Answer */}
                        <label
                          className="flex items-center gap-1.5 cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-white transition-colors"
                          title="Click to designate as the correct answer"
                        >
                          <input
                            type="radio"
                            name="correctOption"
                            checked={isCorrect}
                            onChange={() => setCorrectOptionId(opt.id)}
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <span
                            className={`text-xs font-bold ${
                              isCorrect ? 'text-purple-700' : 'text-slate-600'
                            }`}
                          >
                            {letter}
                          </span>
                        </label>

                        <input
                          type="text"
                          required
                          value={opt.text}
                          onChange={(e) => handleUpdateOption(opt.id, e.target.value)}
                          placeholder={`Option ${letter} text...`}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-500"
                        />

                        {isCorrect ? (
                          <span className="px-2 py-1 bg-purple-600 text-white font-bold text-[10px] rounded-lg shrink-0 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Correct
                          </span>
                        ) : null}

                        {mcqOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(opt.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove option"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Explanation & Solution Hints
                </label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain why the chosen option is correct. Displayed to trainees after evaluation..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TYPE SPECIFIC FIELDS: CODING PROBLEM */}
          {/* ======================================================== */}
          {type === 'coding' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Target Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="python">Python 3.11</option>
                    <option value="javascript">JavaScript (Node 20)</option>
                    <option value="typescript">TypeScript</option>
                    <option value="cpp">C++ (GCC 13)</option>
                    <option value="java">Java 21</option>
                    <option value="go">Go 1.22</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Time Limit (ms)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={timeLimitMs}
                    onChange={(e) => setTimeLimitMs(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Memory Limit (MB)
                  </label>
                  <input
                    type="number"
                    min="64"
                    step="64"
                    value={memoryLimitMb}
                    onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Problem Specification & Constraints
                </label>
                <textarea
                  rows={3}
                  required
                  value={codingPrompt}
                  onChange={(e) => {
                    setCodingPrompt(e.target.value);
                    setDescription(e.target.value);
                  }}
                  placeholder="Describe the function requirements, input format, constraints, and edge cases..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 leading-relaxed font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Starter Code Template
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Boilerplate for trainees
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={starterCode}
                  onChange={(e) => setStarterCode(e.target.value)}
                  placeholder={`# Starter boilerplate for ${language}`}
                  className="w-full px-3.5 py-2.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 leading-relaxed selection:bg-emerald-800"
                />
              </div>

              {/* Test Cases Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Test Cases ({testCases.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTestCase}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Test Case</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {testCases.map((tc, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600">Case #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateTestCase(idx, 'isHidden', !tc.isHidden)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors ${
                              tc.isHidden
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {tc.isHidden ? (
                              <>
                                <EyeOff className="w-3 h-3" />
                                <span>Hidden / Private</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3" />
                                <span>Public / Sample</span>
                              </>
                            )}
                          </button>
                        </div>

                        {testCases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTestCase(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Input Arguments
                          </span>
                          <input
                            type="text"
                            value={tc.input}
                            onChange={(e) => handleUpdateTestCase(idx, 'input', e.target.value)}
                            placeholder="e.g. [2, 7, 11, 15], 9"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Expected Output
                          </span>
                          <input
                            type="text"
                            value={tc.output}
                            onChange={(e) => handleUpdateTestCase(idx, 'output', e.target.value)}
                            placeholder="e.g. [0, 1]"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TYPE SPECIFIC FIELDS: NOTES & REFERENCE RESOURCE */}
          {/* ======================================================== */}
          {type === 'resource' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lecture Notes, Summary & Reading Material <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={6}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter detailed lesson notes, theoretical concepts, formulas, code snippets, or reading summaries..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>External Reference / Documentation Link</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">
                    (optional)
                  </span>
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={resourceLink}
                    onChange={(e) => setResourceLink(e.target.value)}
                    placeholder="https://developer.mozilla.org/..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-400 font-mono">
              {isNew ? (
                <span className="text-emerald-600 font-bold">✨ Direct Curriculum Authoring</span>
              ) : (
                <>ID: {item.id}</>
              )}
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
                className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                  type === 'video'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : type === 'mcq'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : type === 'coding'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isNew ? 'Publish to Curriculum' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

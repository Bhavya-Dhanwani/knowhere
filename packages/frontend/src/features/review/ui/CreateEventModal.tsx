import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Shield,
  Layers,
  Layout,
  Server,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { ProjectScope, Criterion, Requirement, CRITERIA_PRESETS } from '../types';
import { reviewApi } from '../api/reviewApi';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newEventId?: string) => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [projectType, setProjectType] = useState<ProjectScope>('FULLSTACK');
  const [requiresLiveUrl, setRequiresLiveUrl] = useState(false);
  const [requiresApiSpec, setRequiresApiSpec] = useState(true);
  const [criteria, setCriteria] = useState<Criterion[]>(CRITERIA_PRESETS.FULLSTACK);
  const [requirements] = useState<Requirement[]>([
    {
      id: 'req-1',
      title: 'Core Functionality',
      description: 'Implements expected primary feature set',
      mandatory: true
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success State with Shareable URL
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleScopeChange = (scope: ProjectScope) => {
    setProjectType(scope);
    setCriteria(CRITERIA_PRESETS[scope]);
    if (scope === 'FRONTEND') {
      setRequiresApiSpec(false);
      setRequiresLiveUrl(false);
    } else if (scope === 'BACKEND') {
      setRequiresLiveUrl(false);
      setRequiresApiSpec(true);
    } else {
      setRequiresApiSpec(true);
    }
  };

  const handleWeightChange = (index: number, newWeight: number) => {
    const updated = [...criteria];
    updated[index].weight = newWeight;
    setCriteria(updated);
  };

  const handleRemoveCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const handleAddCriterion = () => {
    const newId = `crit-${Date.now()}`;
    setCriteria([
      ...criteria,
      {
        id: newId,
        name: 'Custom Criterion',
        category: 'CODE_QUALITY',
        weight: 0.1,
        description: 'Custom evaluation rule'
      }
    ]);
  };

  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  const isWeightValid = Math.abs(totalWeight - 1.0) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightValid) {
      setError(`Criteria weights must sum to exactly 1.0 (current sum: ${totalWeight.toFixed(2)})`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await reviewApi.createEvent({
        name,
        description,
        problemStatement,
        projectType,
        requiresLiveUrl,
        requiresApiSpec: projectType === 'FRONTEND' ? false : requiresApiSpec,
        criteria,
        requirements
      });
      setCreatedEventId(res._id);
      onCreated(res._id);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to create event';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const submissionUrl = createdEventId
    ? `${window.location.origin}/review/submit/${createdEventId}`
    : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(submissionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetAndClose = () => {
    setCreatedEventId(null);
    setName('');
    setDescription('');
    setProblemStatement('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl my-8 overflow-hidden">
        {/* If Event was created, show the Shareable Submission Form URL Screen */}
        {createdEventId ? (
          <div className="p-8 text-center space-y-6">
            <div className="w-14 h-14 bg-emerald-950 border border-emerald-800 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Event Created Successfully!</h2>
              <p className="text-xs text-slate-400">
                Share this public submission form URL with your candidates or hackathon teams:
              </p>
            </div>

            {/* Copyable Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 max-w-xl mx-auto">
              <span className="text-xs font-mono text-indigo-300 truncate select-all">
                {submissionUrl}
              </span>
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <a
                href={submissionUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Submission Form
              </a>
              <button
                onClick={handleResetAndClose}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Go to Event Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-400" /> Create Review Event
                </h2>
                <p className="text-xs text-slate-400">
                  Configure scope, dynamic rubrics, and generate submission form URL
                </p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-950/50 border border-red-800 text-red-300 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              {/* Scope Selector */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Project Evaluation Scope
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleScopeChange('FRONTEND')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                      projectType === 'FRONTEND'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Layout className="w-5 h-5 mb-1 text-indigo-400" />
                    <span>Frontend Only</span>
                    <span className="text-[10px] text-slate-400">Lighthouse, a11y, UI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScopeChange('BACKEND')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                      projectType === 'BACKEND'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Server className="w-5 h-5 mb-1 text-emerald-400" />
                    <span>Backend Only</span>
                    <span className="text-[10px] text-slate-400">Schemathesis, k6, APIs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScopeChange('FULLSTACK')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                      projectType === 'FULLSTACK'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Layers className="w-5 h-5 mb-1 text-purple-400" />
                    <span>Fullstack</span>
                    <span className="text-[10px] text-slate-400">Full end-to-end audit</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Submission Requirements Toggles */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Dynamic Candidate Submission Requirements
                </span>
                <p className="text-[11px] text-slate-400">
                  Configure what candidate teams must submit. GitHub repository URL and branch are
                  always required.
                </p>

                <div className="space-y-2 pt-1">
                  {/* Live URL Toggle */}
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={requiresLiveUrl}
                      onChange={(e) => setRequiresLiveUrl(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white">
                        Require Deployed Live URL
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Enable only if running automated browser / Lighthouse CI tests. If
                        unchecked, candidates will not be asked for a live URL.
                      </p>
                    </div>
                  </label>

                  {/* Swagger / OpenAPI Toggle */}
                  {projectType !== 'FRONTEND' ? (
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={requiresApiSpec}
                        onChange={(e) => setRequiresApiSpec(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white">
                          Require OpenAPI / Swagger Spec or Base URL
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Enable for Schemathesis endpoint fuzzing and API contract validation.
                        </p>
                      </div>
                    </label>
                  ) : (
                    <div className="p-2.5 bg-indigo-950/30 border border-indigo-900/40 rounded-lg text-xs text-indigo-300 flex items-center gap-2">
                      <Layout className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <span>Frontend projects never ask for Swagger / OpenAPI specs.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Basic Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Event Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Spring 2026 Hackathon Final"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief summary of the evaluation event"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Problem Statement
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={problemStatement}
                    onChange={(e) => setProblemStatement(e.target.value)}
                    placeholder="Candidate requirement objectives against which the AI and tools will evaluate submissions..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Dynamic Criteria Section */}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Dynamic Rubric Criteria</h3>
                    <p className="text-xs text-slate-400">
                      Each criterion is evidence-grounded and automatically scored
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-mono ${
                        isWeightValid
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      Weight Sum: {totalWeight.toFixed(2)} / 1.00
                    </span>
                    <button
                      type="button"
                      onClick={handleAddCriterion}
                      className="text-xs flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Criterion
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {criteria.map((crit, idx) => (
                    <div
                      key={crit.id}
                      className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800/80 rounded-xl"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          value={crit.name}
                          onChange={(e) => {
                            const updated = [...criteria];
                            updated[idx].name = e.target.value;
                            setCriteria(updated);
                          }}
                          className="w-full bg-transparent text-sm font-medium text-white focus:outline-none"
                        />
                        <input
                          type="text"
                          value={crit.description}
                          onChange={(e) => {
                            const updated = [...criteria];
                            updated[idx].description = e.target.value;
                            setCriteria(updated);
                          }}
                          placeholder="Description"
                          className="w-full bg-transparent text-xs text-slate-400 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Weight:</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0.05"
                          max="1.0"
                          value={crit.weight}
                          onChange={(e) => handleWeightChange(idx, parseFloat(e.target.value) || 0)}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCriterion(idx)}
                          disabled={criteria.length <= 1}
                          className="text-slate-500 hover:text-red-400 p-1 transition disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !isWeightValid}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
                >
                  {loading ? 'Creating...' : 'Create Event & Get Form URL'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

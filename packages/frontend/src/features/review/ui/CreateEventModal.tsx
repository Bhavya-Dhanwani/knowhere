import React, { useState } from 'react';
import { ModalShell } from '../../../shared/ui/ModalShell';
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
    <ModalShell onClose={onClose} size="3xl">
      <div className="flex min-h-0 flex-col overflow-hidden text-zinc-900 font-sans">
        {/* If Event was created, show the Shareable Submission Form URL Screen */}
        {createdEventId ? (
          <div className="p-5 sm:p-8 text-center space-y-6">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-zinc-900">Event Created Successfully!</h2>
              <p className="text-xs text-zinc-500">
                Share this public submission form URL with your candidates or hackathon teams:
              </p>
            </div>

            {/* Copyable Box */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex items-center justify-between gap-3 max-w-xl mx-auto">
              <span className="text-xs font-mono text-blue-700 truncate select-all font-medium">
                {submissionUrl}
              </span>
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition shadow-sm"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-white" />
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
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-zinc-200"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Submission Form
              </a>
              <button
                onClick={handleResetAndClose}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
              >
                Go to Event Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 border-b border-zinc-200 bg-white">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" /> Create Review Event
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Configure scope, dynamic rubrics, and generate submission form URL
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto bg-white"
            >
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              {/* Scope Selector */}
              <div>
                <label className="block text-sm font-semibold text-zinc-800 mb-2">
                  Project Evaluation Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleScopeChange('FRONTEND')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                      projectType === 'FRONTEND'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
                    }`}
                  >
                    <Layout className="w-5 h-5 mb-1 text-blue-600" />
                    <span className="font-semibold">Frontend Only</span>
                    <span className="text-[10px] text-zinc-500">Lighthouse, a11y, UI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScopeChange('BACKEND')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                      projectType === 'BACKEND'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
                    }`}
                  >
                    <Server className="w-5 h-5 mb-1 text-emerald-600" />
                    <span className="font-semibold">Backend Only</span>
                    <span className="text-[10px] text-zinc-500">Schemathesis, k6, APIs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScopeChange('FULLSTACK')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                      projectType === 'FULLSTACK'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
                    }`}
                  >
                    <Layers className="w-5 h-5 mb-1 text-purple-600" />
                    <span className="font-semibold">Fullstack</span>
                    <span className="text-[10px] text-zinc-500">Full end-to-end audit</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Submission Requirements Toggles */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                  Dynamic Candidate Submission Requirements
                </span>
                <p className="text-[11px] text-zinc-500">
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
                      className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-800">
                        Require Deployed Live URL
                      </span>
                      <p className="text-[11px] text-zinc-500">
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
                        className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-semibold text-zinc-800">
                          Require OpenAPI / Swagger Spec or Base URL
                        </span>
                        <p className="text-[11px] text-zinc-500">
                          Enable for Schemathesis endpoint fuzzing and API contract validation.
                        </p>
                      </div>
                    </label>
                  ) : (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                      <Layout className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span>Frontend projects never ask for Swagger / OpenAPI specs.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Basic Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                    Event Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Spring 2026 Hackathon Final"
                    className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-zinc-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief summary of the evaluation event"
                    className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-zinc-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                    Problem Statement
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={problemStatement}
                    onChange={(e) => setProblemStatement(e.target.value)}
                    placeholder="Candidate requirement objectives against which the AI and tools will evaluate submissions..."
                    className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-zinc-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
              </div>

              {/* Dynamic Criteria Section */}
              <div className="border-t border-zinc-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Dynamic Rubric Criteria</h3>
                    <p className="text-xs text-zinc-500">
                      Each criterion is evidence-grounded and automatically scored
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-mono font-semibold ${
                        isWeightValid
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      Weight Sum: {totalWeight.toFixed(2)} / 1.00
                    </span>
                    <button
                      type="button"
                      onClick={handleAddCriterion}
                      className="text-xs flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 px-2.5 py-1.5 rounded-lg transition font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Criterion
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {criteria.map((crit, idx) => (
                    <div
                      key={crit.id}
                      className="flex items-center gap-2 p-3 bg-zinc-50 border border-zinc-200 rounded-xl"
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
                          className="w-full bg-transparent text-sm font-semibold text-zinc-900 focus:outline-none"
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
                          className="w-full bg-transparent text-xs text-zinc-500 focus:outline-none mt-0.5"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Weight:</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0.05"
                          max="1.0"
                          value={crit.weight}
                          onChange={(e) => handleWeightChange(idx, parseFloat(e.target.value) || 0)}
                          className="w-16 bg-white border border-zinc-300 rounded-lg px-2 py-1 text-xs text-zinc-900 text-center font-mono font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCriterion(idx)}
                          disabled={criteria.length <= 1}
                          className="text-zinc-400 hover:text-red-600 p-1 transition disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !isWeightValid}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-2"
                >
                  {loading ? 'Creating...' : 'Create Event & Get Form URL'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </ModalShell>
  );
};

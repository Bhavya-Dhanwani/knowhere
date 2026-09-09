import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Shield, Layers, Layout, Server, AlertCircle, Save } from 'lucide-react';
import { ProjectScope, Criterion, ReviewEvent, CRITERIA_PRESETS } from '../types';
import { reviewApi } from '../api/reviewApi';

interface EditEventModalProps {
  isOpen: boolean;
  event: ReviewEvent | null;
  onClose: () => void;
  onUpdated: (updatedEvent: ReviewEvent) => void;
}

export const EditEventModal: React.FC<EditEventModalProps> = ({
  isOpen,
  event,
  onClose,
  onUpdated
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [projectType, setProjectType] = useState<ProjectScope>('FULLSTACK');
  const [requiresLiveUrl, setRequiresLiveUrl] = useState(false);
  const [requiresApiSpec, setRequiresApiSpec] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setName(event.name || '');
      setDescription(event.description || '');
      setProblemStatement(event.problemStatement || '');
      setProjectType(event.projectType || 'FULLSTACK');
      setRequiresLiveUrl(event.requiresLiveUrl ?? false);
      setRequiresApiSpec(
        event.projectType === 'FRONTEND'
          ? false
          : (event.requiresApiSpec ??
              (event.projectType === 'BACKEND' || event.projectType === 'FULLSTACK'))
      );
      setCriteria(
        event.criteria && event.criteria.length > 0
          ? event.criteria
          : CRITERIA_PRESETS[event.projectType || 'FULLSTACK']
      );
      setError(null);
    }
  }, [event, isOpen]);

  if (!isOpen || !event) return null;

  const handleScopeChange = (scope: ProjectScope) => {
    setProjectType(scope);
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

  const handleResetCriteriaToPreset = () => {
    setCriteria(CRITERIA_PRESETS[projectType]);
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
        category: projectType === 'FRONTEND' ? 'FRONTEND' : 'CODE_QUALITY',
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
      const updated = await reviewApi.updateEvent(event._id, {
        name,
        description,
        problemStatement,
        projectType,
        requiresLiveUrl,
        requiresApiSpec: projectType === 'FRONTEND' ? false : requiresApiSpec,
        criteria,
        requirements: event.requirements
      });
      onUpdated(updated);
      onClose();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to update event';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-3xl shadow-2xl my-8 overflow-hidden text-zinc-900 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" /> Edit Review Event
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Update event scope, submission requirements, and scoring rubrics
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
          className="p-6 space-y-6 max-h-[80vh] overflow-y-auto bg-white"
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
            <div className="grid grid-cols-3 gap-3">
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
                <span className="text-[10px] text-zinc-500">No Swagger / API spec required</span>
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
                <span className="text-[10px] text-zinc-500">No live browser required</span>
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
              Only ask candidates for what is genuinely necessary. Repository URL and branch are
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
                    Enable only if running automated browser / Lighthouse CI tests. If unchecked,
                    candidates will not be asked for a live URL.
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
                placeholder="e.g. Frontend UI Hackathon"
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
                  Weights must sum to 1.0. AI and deterministic tools score against these criteria.
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
                  onClick={handleResetCriteriaToPreset}
                  className="text-xs flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 px-2.5 py-1.5 rounded-lg transition font-medium"
                >
                  Load {projectType} Preset
                </button>
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
              className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isWeightValid}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving Changes...' : 'Save Event Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

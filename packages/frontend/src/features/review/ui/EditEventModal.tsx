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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" /> Edit Review Event
            </h2>
            <p className="text-xs text-slate-400">
              Update event scope, submission requirements, and scoring rubrics
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
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm shadow-indigo-500/20'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Layout className="w-5 h-5 mb-1 text-indigo-400" />
                <span>Frontend Only</span>
                <span className="text-[10px] text-slate-400">No Swagger / API spec required</span>
              </button>

              <button
                type="button"
                onClick={() => handleScopeChange('BACKEND')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                  projectType === 'BACKEND'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm shadow-indigo-500/20'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Server className="w-5 h-5 mb-1 text-emerald-400" />
                <span>Backend Only</span>
                <span className="text-[10px] text-slate-400">No live browser required</span>
              </button>

              <button
                type="button"
                onClick={() => handleScopeChange('FULLSTACK')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                  projectType === 'FULLSTACK'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm shadow-indigo-500/20'
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
                  className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-semibold text-white">
                    Require Deployed Live URL
                  </span>
                  <p className="text-[11px] text-slate-400">
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
                placeholder="e.g. Frontend UI Hackathon"
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetCriteriaToPreset}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition"
                >
                  Load {projectType} Preset
                </button>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-mono ${
                    isWeightValid
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  Sum: {totalWeight.toFixed(2)} / 1.00
                </span>
                <button
                  type="button"
                  onClick={handleAddCriterion}
                  className="text-xs flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
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
                      className="w-full bg-transparent text-sm font-medium text-white focus:outline-none border-b border-transparent focus:border-indigo-500 pb-0.5"
                    />
                    <input
                      type="text"
                      value={crit.description}
                      onChange={(e) => {
                        const updated = [...criteria];
                        updated[idx].description = e.target.value;
                        setCriteria(updated);
                      }}
                      placeholder="Audit description / requirements"
                      className="w-full bg-transparent text-xs text-slate-400 focus:outline-none mt-1"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Weight:</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={crit.weight}
                      onChange={(e) => handleWeightChange(idx, parseFloat(e.target.value) || 0)}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCriterion(idx)}
                      disabled={criteria.length <= 1}
                      className="p-1.5 text-slate-400 hover:text-red-400 disabled:opacity-30 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isWeightValid}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
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

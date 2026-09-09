import React, { useState, useEffect } from 'react';
import { X, Save, GitBranch, Globe, FileCode, AlertCircle, FileText } from 'lucide-react';
import { ReviewEvent, ReviewSubmission } from '../types';
import { reviewApi } from '../api/reviewApi';

interface EditSubmissionModalProps {
  isOpen: boolean;
  submission: ReviewSubmission | null;
  event: ReviewEvent | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const EditSubmissionModal: React.FC<EditSubmissionModalProps> = ({
  isOpen,
  submission,
  event,
  onClose,
  onUpdated
}) => {
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [liveSiteUrl, setLiveSiteUrl] = useState('');
  const [apiSpecUrl, setApiSpecUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (submission) {
      setTeamName(submission.teamName || '');
      setTeamId(submission.teamId || '');
      setRepositoryUrl((submission.repositoryUrl || '').trim());
      setBranch((submission.branch || 'main').trim());
      setLiveSiteUrl((submission.liveSiteUrl || '').trim());
      setApiSpecUrl((submission.apiSpecUrl || '').trim());
      setError(null);
    }
  }, [submission, isOpen]);

  if (!isOpen || !submission) return null;

  // Dynamic input determination based on event scope and configuration
  const needsLiveSiteUrl =
    event?.requiresLiveUrl ??
    (event?.projectType !== 'BACKEND' &&
      (event?.criteria || []).some((c) => {
        const text = `${c.name} ${c.description || ''}`.toLowerCase();
        return (
          text.includes('lighthouse') || text.includes('live site') || text.includes('deployed url')
        );
      }));

  const needsApiSpecUrl =
    event?.projectType === 'FRONTEND'
      ? false
      : (event?.requiresApiSpec ??
        (event?.projectType === 'BACKEND' ||
          (event?.criteria || []).some((c) => {
            const text = `${c.name} ${c.description || ''} ${c.category}`.toLowerCase();
            return (
              text.includes('swagger') ||
              text.includes('openapi') ||
              text.includes('schemathesis') ||
              c.category === 'API_CONTRACT'
            );
          })));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repositoryUrl.trim()) {
      setError('Repository URL is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await reviewApi.updateSubmission(submission._id, {
        teamName: teamName.trim(),
        teamId: teamId.trim(),
        repositoryUrl: repositoryUrl.trim(),
        branch: branch.trim() || 'main',
        liveSiteUrl: needsLiveSiteUrl ? liveSiteUrl.trim() : '',
        apiSpecUrl: needsApiSpecUrl ? apiSpecUrl.trim() : ''
      });
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to update submission';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-lg shadow-2xl my-8 overflow-hidden text-zinc-900 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-blue-600" /> Edit Submission
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Update repository link, branch, team credentials, or deployed endpoints
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
          className="p-6 space-y-4 max-h-[80vh] overflow-y-auto bg-white"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Team Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                Team Name
              </label>
              <input
                type="text"
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2 text-zinc-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                Team ID / Slug
              </label>
              <input
                type="text"
                required
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2 text-zinc-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition font-mono"
              />
            </div>
          </div>

          {/* Repository & Branch */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-blue-600" /> Repository URL
              </label>
              <input
                type="url"
                required
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2 text-zinc-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2 text-zinc-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition font-mono"
              />
            </div>
          </div>

          {/* Dynamic Live Site URL */}
          {needsLiveSiteUrl && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" /> Deployed Live Site URL
              </label>
              <input
                type="url"
                value={liveSiteUrl}
                onChange={(e) => setLiveSiteUrl(e.target.value)}
                placeholder="https://my-app.vercel.app"
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2 text-zinc-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Required for Lighthouse CI and browser evaluation.
              </p>
            </div>
          )}

          {/* Dynamic API Spec URL */}
          {needsApiSpecUrl && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase mb-1 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-600" /> OpenAPI / Swagger Spec or Base
                URL
              </label>
              <input
                type="text"
                value={apiSpecUrl}
                onChange={(e) => setApiSpecUrl(e.target.value)}
                placeholder="https://api.my-app.com/openapi.json"
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2 text-zinc-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Required for Schemathesis endpoint fuzzing & API validation.
              </p>
            </div>
          )}

          {/* Automatic Repository Extraction Information */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-700 flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-zinc-900 block text-xs">
                Automatic Repository Extraction
              </span>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Project documentation (<code className="text-blue-700 font-mono">README.md</code>
                ), structure, and tests are extracted automatically from your GitHub repository
                during evaluation.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

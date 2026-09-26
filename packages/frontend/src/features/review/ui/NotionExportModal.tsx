import React, { useState, useEffect } from 'react';
import { ModalShell } from '../../../shared/ui/ModalShell';
import {
  X,
  Copy,
  Check,
  Download,
  Send,
  ExternalLink,
  Sparkles,
  AlertCircle,
  FileText,
  Eye,
  Terminal,
  Loader2
} from 'lucide-react';
import { reviewApi } from '../api/reviewApi';

interface NotionExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'event' | 'submission';
  id: string;
  title: string;
}

export const NotionExportModal: React.FC<NotionExportModalProps> = ({
  isOpen,
  onClose,
  type,
  id,
  title
}) => {
  const [activeTab, setActiveTab] = useState<'PREVIEW' | 'MARKDOWN' | 'PUSH'>('PREVIEW');
  const [loading, setLoading] = useState(false);
  const [exportData, setExportData] = useState<{ title: string; markdown: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Notion API Push state
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('redesign_notion_api_key') || '');
  const [parentPageId, setParentPageId] = useState(
    () => localStorage.getItem('redesign_notion_parent_page_id') || ''
  );
  const [rememberCreds, setRememberCreds] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    success: boolean;
    url?: string;
    pageId?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !id) return;

    const fetchExport = async () => {
      try {
        setLoading(true);
        setPushResult(null);
        if (type === 'event') {
          const res = await reviewApi.getEventNotionExport(id);
          setExportData(res);
        } else {
          const res = await reviewApi.getSubmissionNotionExport(id);
          setExportData(res);
        }
      } catch (err) {
        console.error('Failed to load Notion export', err);
      } finally {
        setLoading(false);
      }
    };

    fetchExport();
  }, [isOpen, type, id]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!exportData?.markdown) return;
    navigator.clipboard.writeText(exportData.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!exportData?.markdown) return;
    const blob = new Blob([exportData.markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedTitle = (exportData.title || title).toLowerCase().replace(/[^a-z0-9]/g, '-');
    link.setAttribute('download', `${sanitizedTitle}.md`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handlePushToNotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !parentPageId.trim()) return;

    if (rememberCreds) {
      localStorage.setItem('redesign_notion_api_key', apiKey.trim());
      localStorage.setItem('redesign_notion_parent_page_id', parentPageId.trim());
    } else {
      localStorage.removeItem('redesign_notion_api_key');
      localStorage.removeItem('redesign_notion_parent_page_id');
    }

    try {
      setPushing(true);
      setPushResult(null);
      let res;
      if (type === 'event') {
        res = await reviewApi.pushEventToNotion(id, {
          apiKey: apiKey.trim(),
          parentPageId: parentPageId.trim()
        });
      } else {
        res = await reviewApi.pushSubmissionToNotion(id, {
          apiKey: apiKey.trim(),
          parentPageId: parentPageId.trim()
        });
      }
      setPushResult(res);
    } catch (err: any) {
      setPushResult({
        success: false,
        error:
          err?.response?.data?.error ||
          err?.message ||
          'Failed to communicate with Notion API. Please check your token and page permissions.'
      });
    } finally {
      setPushing(false);
    }
  };

  return (
    <ModalShell onClose={onClose} size="4xl">
      <div className="flex min-h-0 flex-col max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-4 sm:px-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-serif font-black text-base shadow-sm">
              N
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                Notion Final Report Export
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-sans font-semibold">
                  {type === 'event' ? 'Event Master' : 'Single Project'}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 truncate max-w-md">
                {exportData?.title || title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-3 pb-2 border-b border-zinc-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('PREVIEW')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'PREVIEW'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              Document Preview
            </button>
            <button
              onClick={() => setActiveTab('MARKDOWN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'MARKDOWN'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              Notion Markdown (.md)
            </button>
            <button
              onClick={() => setActiveTab('PUSH')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'PUSH'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              Direct Notion Sync
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={loading || !exportData}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shadow-sm ${
                copied
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button
              onClick={handleDownload}
              disabled={loading || !exportData}
              className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download .md
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50/50">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs text-zinc-500 font-medium">
                Generating Notion-formatted executive dossier...
              </p>
            </div>
          ) : !exportData ? (
            <div className="py-16 text-center text-zinc-500 text-xs">
              No report available. Please ensure the pipeline or ranking has been run.
            </div>
          ) : activeTab === 'PREVIEW' ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-4 max-w-3xl mx-auto">
              {/* Native Notion Style Renderer */}
              <div className="space-y-4 font-sans text-xs leading-relaxed text-zinc-800">
                <div className="border-b border-zinc-100 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🏆</span>
                    <h1 className="text-xl font-black text-zinc-950">{exportData.title}</h1>
                  </div>
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">RE:DESIGN Evidence-First Evaluation Engine</p>
                      <p className="text-zinc-600 text-[11px] mt-0.5">
                        Includes calibrated podium rankings, concrete + points, static analysis
                        audits, and actionable improvement roadmaps formatted for Notion.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Markdown preview rendering preview blocks */}
                <div className="prose prose-zinc prose-xs max-w-none">
                  <pre className="p-4 bg-zinc-900 text-zinc-100 rounded-xl text-[11px] font-mono whitespace-pre-wrap leading-normal overflow-x-auto max-h-[450px]">
                    {exportData.markdown}
                  </pre>
                </div>
              </div>
            </div>
          ) : activeTab === 'MARKDOWN' ? (
            <div className="space-y-3 max-w-3xl mx-auto">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  Directly importable into Notion via{' '}
                  <b>Settings &gt; Import &gt; Markdown (.md)</b>
                </span>
                <span>{exportData.markdown.split('\n').length} lines</span>
              </div>
              <textarea
                readOnly
                value={exportData.markdown}
                className="w-full h-[450px] p-4 bg-white border border-zinc-200 rounded-xl font-mono text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm resize-none"
              />
            </div>
          ) : (
            /* Tab 3: Direct Push to Notion API */
            <div className="max-w-xl mx-auto bg-white border border-zinc-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-5">
              <div>
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-zinc-900">
                    Publish Directly to Your Notion Workspace
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Pushes this evaluation report as a sub-page directly under any Notion page in your
                  workspace.
                </p>
              </div>

              {pushResult && (
                <div
                  className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                    pushResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  {pushResult.success ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-bold">
                      {pushResult.success
                        ? 'Successfully published to Notion!'
                        : 'Failed to publish to Notion'}
                    </p>
                    {pushResult.error && (
                      <p className="text-[11px] text-red-700">{pushResult.error}</p>
                    )}
                    {pushResult.url && (
                      <a
                        href={pushResult.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold underline text-xs mt-1"
                      >
                        Open Published Page in Notion <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handlePushToNotion} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Notion Internal Integration Token (API Key)
                  </label>
                  <input
                    type="password"
                    placeholder="secret_..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-zinc-400 mt-1 block">
                    Create a Notion integration at{' '}
                    <a
                      href="https://www.notion.so/my-integrations"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      notion.so/my-integrations
                    </a>
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Parent Page ID (where page should be created)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
                    value={parentPageId}
                    onChange={(e) => setParentPageId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-zinc-400 mt-1 block">
                    Copy the 32-character ID from your Notion page URL and connect your integration
                    to that page via <b>&bull;&bull;&bull; &gt; Connections</b>.
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="rememberCreds"
                    checked={rememberCreds}
                    onChange={(e) => setRememberCreds(e.target.checked)}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="rememberCreds" className="text-zinc-600 font-medium select-none">
                    Remember token and parent page ID in browser
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={pushing || !apiKey.trim() || !parentPageId.trim()}
                    className="w-full py-2.5 bg-black hover:bg-zinc-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    {pushing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Publishing to Notion Workspace...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Publish to Notion Workspace</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-6 border-t border-zinc-100 bg-zinc-50/70 flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            RE:DESIGN Report Exporter • Ranks, Issues, Roadmap &amp; + Points
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 font-semibold border border-zinc-200 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

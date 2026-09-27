import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FormField, Requirement, IoTest } from '../types';

const FIELD_TYPES: Array<{ value: FormField['type']; label: string }> = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'url', label: 'Link' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' }
];

/** Organiser side: build the extra questions students answer when submitting. */
export const FormFieldsEditor: React.FC<{
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}> = ({ fields, onChange }) => {
  const update = (i: number, patch: Partial<FormField>) =>
    onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <div className="border-t border-zinc-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Custom Submission Form</h3>
          <p className="text-xs text-zinc-500">
            Extra questions students answer (demo video, approach, track...). Answers are fed to the
            evaluator.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...fields,
              { id: `field-${Date.now()}`, label: '', type: 'text', required: false }
            ])
          }
          className="text-xs flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 px-2.5 py-1.5 rounded-lg transition font-medium flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Question
        </button>
      </div>

      <div className="space-y-2">
        {fields.map((f, i) => (
          <div key={f.id} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                required
                aria-label="Question label"
                value={f.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Question, e.g. Demo video link"
                className="flex-1 min-w-[10rem] bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-sm text-zinc-900"
              />
              <select
                aria-label="Answer type"
                value={f.type}
                onChange={(e) => update(i, { type: e.target.value as FormField['type'] })}
                className="bg-white border border-zinc-300 rounded-lg px-2 py-1.5 text-xs text-zinc-900"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-zinc-700 select-none">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                  className="rounded border-zinc-300 text-blue-600"
                />
                Required
              </label>
              <button
                type="button"
                aria-label="Remove question"
                onClick={() => onChange(fields.filter((_, j) => j !== i))}
                className="text-zinc-400 hover:text-red-600 p-1 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {f.type === 'select' && (
              <input
                type="text"
                required
                aria-label="Dropdown options"
                value={(f.options || []).join(', ')}
                onChange={(e) =>
                  update(i, {
                    options: e.target.value
                      .split(',')
                      .map((o) => o.trim())
                      .filter(Boolean)
                  })
                }
                placeholder="Options, comma separated: AI, Web, Mobile"
                className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900"
              />
            )}
            <input
              type="text"
              aria-label="Help text"
              value={f.helpText || ''}
              onChange={(e) => update(i, { helpText: e.target.value })}
              placeholder="Help text (optional)"
              className="w-full bg-transparent text-xs text-zinc-500 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Organiser side: the concrete things a submission must do. Each one is checked against the
 * repo + live site and reported FULFILLED / PARTIAL / NOT_FULFILLED with evidence; the
 * head-to-head judge weighs a missing mandatory one above style. (The score itself is the
 * weighted criteria.)
 */
export const RequirementsEditor: React.FC<{
  requirements: Requirement[];
  onChange: (requirements: Requirement[]) => void;
}> = ({ requirements, onChange }) => {
  const update = (i: number, patch: Partial<Requirement>) =>
    onChange(requirements.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="border-t border-zinc-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Problem Requirements</h3>
          <p className="text-xs text-zinc-500">
            List what a correct solution must do. Specific beats vague: "JWT login at POST
            /api/auth/login" scores far more accurately than "has auth".
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...requirements,
              { id: `req-${Date.now()}`, title: '', description: '', mandatory: true }
            ])
          }
          className="text-xs flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 px-2.5 py-1.5 rounded-lg transition font-medium flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Requirement
        </button>
      </div>

      <div className="space-y-2">
        {requirements.map((r, i) => (
          <div key={r.id} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                required
                aria-label="Requirement title"
                value={r.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="e.g. User can reset password"
                className="flex-1 min-w-[10rem] bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-sm text-zinc-900"
              />
              <label className="flex items-center gap-1.5 text-xs text-zinc-700 select-none">
                <input
                  type="checkbox"
                  checked={r.mandatory}
                  onChange={(e) => update(i, { mandatory: e.target.checked })}
                  className="rounded border-zinc-300 text-blue-600"
                />
                Mandatory
              </label>
              <button
                type="button"
                aria-label="Remove requirement"
                onClick={() => onChange(requirements.filter((_, j) => j !== i))}
                disabled={requirements.length <= 1}
                className="text-zinc-400 hover:text-red-600 p-1 transition disabled:opacity-30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <textarea
              required
              rows={2}
              aria-label="Requirement details"
              value={r.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder="How to verify it: expected behaviour, page, or endpoint"
              className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900"
            />
            <input
              type="text"
              aria-label="Where to look"
              value={r.targetEndpointOrFile || ''}
              onChange={(e) => update(i, { targetEndpointOrFile: e.target.value })}
              placeholder="Where to look (optional): /api/auth/reset, src/pages/Reset.tsx, /reset"
              className="w-full bg-transparent text-xs text-zinc-500 focus:outline-none font-mono"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

/** `<input type="datetime-local">` speaks local time without a zone; convert both ways. */
export const toLocalInput = (iso?: string | null) =>
  iso
    ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : '';
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const DeadlineInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({
  value,
  onChange
}) => (
  <div>
    <label
      htmlFor="submission-deadline"
      className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
    >
      Submission Deadline (optional)
    </label>
    <input
      id="submission-deadline"
      type="datetime-local"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-zinc-900 text-sm"
    />
    <p className="text-[11px] text-zinc-500 mt-1">
      After this, students can no longer submit or edit. Each submission is pinned to the exact
      commit it was made at, so later pushes never change a score.
    </p>
  </div>
);

/** Organiser's own words on how to judge: read by the grader and the head-to-head judge. */
/**
 * Organiser side: hidden test cases (stdin -> expected stdout) run against every submission's
 * built program. Students never see them. Blank run command = auto-detect.
 */
export const IoTestsEditor: React.FC<{
  tests: IoTest[];
  onChange: (tests: IoTest[]) => void;
  runCommand: string;
  onRunCommandChange: (v: string) => void;
}> = ({ tests, onChange, runCommand, onRunCommandChange }) => {
  const update = (i: number, patch: Partial<IoTest>) =>
    onChange(tests.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="border-t border-zinc-200 pt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Hidden Test Cases (optional)</h3>
          <p className="text-xs text-zinc-500">
            For programs that read input and print output (DSA, CLI). Each submission is built and
            run against these; students never see them.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([...tests, { name: `case ${tests.length + 1}`, input: '', expected: '' }])
          }
          className="text-xs flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 px-2.5 py-1.5 rounded-lg transition font-medium flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Case
        </button>
      </div>
      {tests.length > 0 && (
        <input
          type="text"
          aria-label="Run command"
          value={runCommand}
          onChange={(e) => onRunCommandChange(e.target.value)}
          placeholder="Run command (optional, auto-detected): e.g. ./app, python3 main.py, java -cp _classes Main"
          className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 font-mono"
        />
      )}
      {tests.map((t, i) => (
        <div key={i} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Case name"
              value={t.name || ''}
              onChange={(e) => update(i, { name: e.target.value })}
              className="flex-1 bg-transparent text-sm font-semibold text-zinc-900 focus:outline-none"
            />
            <button
              type="button"
              aria-label="Remove case"
              onClick={() => onChange(tests.filter((_, j) => j !== i))}
              className="text-zinc-400 hover:text-red-600 p-1 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <textarea
              rows={3}
              aria-label="Input (stdin)"
              value={t.input}
              onChange={(e) => update(i, { input: e.target.value })}
              placeholder="Input (stdin)"
              className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 font-mono"
            />
            <textarea
              rows={3}
              required
              aria-label="Expected output (stdout)"
              value={t.expected}
              onChange={(e) => update(i, { expected: e.target.value })}
              placeholder="Expected output (stdout)"
              className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 font-mono"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export const JudgingPromptInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  isPublic: boolean;
  onPublicChange: (v: boolean) => void;
}> = ({ value, onChange, isPublic, onPublicChange }) => (
  <div>
    <label
      htmlFor="judging-prompt"
      className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
    >
      Judging Instructions (optional)
    </label>
    <textarea
      id="judging-prompt"
      rows={4}
      maxLength={4000}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        'Tell the AI judge what matters, in your own words, for whatever stack this event uses. e.g.\n"Reward working features, correct error handling and clean, idiomatic code for the language used. Penalise copy-pasted code and hard-coded secrets. Beginners: don\'t penalise missing tests."'
      }
      className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-zinc-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
    />
    <p className="text-[11px] text-zinc-500 mt-1">
      Applied to every criterion and to the rankings. It also steers which files the judge reads
      first, so name the concrete things you care about (features, modules, functions, techniques).
    </p>
    <label className="flex items-center gap-2 text-xs text-zinc-700 mt-1.5 select-none">
      <input
        type="checkbox"
        checked={isPublic}
        onChange={(e) => onPublicChange(e.target.checked)}
        className="rounded border-zinc-300 text-blue-600"
      />
      Show these instructions to students on the submission page
    </label>
  </div>
);

/** Student side: render the event's custom questions with the host form's styling. */
export const CustomFormInputs: React.FC<{
  fields: FormField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  labelClassName: string;
  inputClassName: string;
}> = ({ fields, values, onChange, labelClassName, inputClassName }) => (
  <>
    {fields.map((f) => {
      const common = {
        id: `ff-${f.id}`,
        required: f.required,
        value: values[f.id] || '',
        className: inputClassName,
        onChange: (
          e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
        ) => onChange({ ...values, [f.id]: e.target.value })
      };
      return (
        <div key={f.id}>
          <label htmlFor={common.id} className={labelClassName}>
            {f.label}
            {f.required && ' *'}
          </label>
          {f.type === 'textarea' ? (
            <textarea rows={4} maxLength={5000} {...common} />
          ) : f.type === 'select' ? (
            <select {...common}>
              <option value="">Select...</option>
              {(f.options || []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input type={f.type} maxLength={5000} {...common} />
          )}
          {f.helpText && <p className="text-[11px] text-zinc-500 mt-1">{f.helpText}</p>}
        </div>
      );
    })}
  </>
);

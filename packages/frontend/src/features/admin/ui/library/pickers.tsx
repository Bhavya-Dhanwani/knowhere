import React from 'react';
import { Paperclip, X } from 'lucide-react';
import { cn } from '../../../../shared/lib/cn';
import { Library } from '../../../course/api/contentApi';

export interface PickOption {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

// Checklist where click order is the final order (shown as 1, 2, 3…).
export const OrderedPicker: React.FC<{
  options: PickOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  empty?: string;
}> = ({ options, value, onChange, empty = 'Nothing to pick yet.' }) => {
  if (!options.length) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">
        {empty}
      </p>
    );
  }
  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-zinc-50 p-1.5 ring-1 ring-inset ring-zinc-200/70">
      {options.map((o) => {
        const pos = value.indexOf(o.id);
        const on = pos >= 0;
        return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
              aria-pressed={on}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition',
                on ? 'bg-white shadow-card' : 'hover:bg-white/70'
              )}
            >
              <span
                className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold tabular-nums',
                  on
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-zinc-400 ring-1 ring-inset ring-zinc-200'
                )}
              >
                {on ? pos + 1 : null}
              </span>
              {o.icon ? <span className="shrink-0">{o.icon}</span> : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-900">{o.label}</span>
                {o.sublabel ? (
                  <span className="block truncate text-xs text-zinc-500">{o.sublabel}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

// Attach already-uploaded files (images, PDFs…) to a question, option or explanation.
export const AttachResources: React.FC<{
  resources: Library['resources'];
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}> = ({ resources, value, onChange, label = 'Attach file' }) => {
  const byId = new Map(resources.map((r) => [r._id, r]));
  const available = resources.filter((r) => r.resourceType !== 'video' && !value.includes(r._id));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((id) => (
        <span
          key={id}
          className="inline-flex max-w-[200px] items-center gap-1 rounded-lg bg-sky-50 py-1 pl-2 pr-1 text-xs text-sky-800 ring-1 ring-inset ring-sky-200"
        >
          <span className="truncate">{byId.get(id)?.fileName || id}</span>
          <button
            type="button"
            onClick={() => onChange(value.filter((v) => v !== id))}
            aria-label="Remove attachment"
            className="grid h-4 w-4 place-items-center rounded hover:bg-sky-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {available.length ? (
        <label className="relative inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 ring-1 ring-inset ring-zinc-200 hover:text-zinc-800">
          <Paperclip className="h-3 w-3" /> {label}
          <select
            value=""
            onChange={(e) => e.target.value && onChange([...value, e.target.value])}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={label}
          >
            <option value="">Choose…</option>
            {available.map((r) => (
              <option key={r._id} value={r._id}>
                {r.fileName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
};

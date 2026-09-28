import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, Eye, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  Certificate,
  Experience,
  lmsApi,
  Profile,
  ProfileLink,
  Qualification
} from '../../../shared/api/lms';
import { Button } from '../../../shared/ui/Button';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { cn } from '../../../shared/lib/cn';
import { ProfileView, shareUrl } from './ProfileView';

const input =
  'h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400';
const area =
  'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400';

const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children
}) => (
  <section className="rounded-2xl border border-zinc-200/80 bg-white p-5">
    <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
    {hint ? <p className="mt-0.5 text-sm text-zinc-500">{hint}</p> : null}
    <div className="mt-4 space-y-3">{children}</div>
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className
}) => (
  <label className={cn('block', className)}>
    <span className="mb-1.5 block text-[13px] font-medium text-zinc-700">{label}</span>
    {children}
  </label>
);

// type-and-Enter tags (skills, interests)
const ChipsInput: React.FC<{
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  max: number;
}> = ({ label, values, onChange, placeholder, max }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim().slice(0, 40);
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase()) && values.length < max) {
      onChange([...values, v]);
    }
    setDraft('');
  };
  return (
    <Field label={`${label} (${values.length}/${max})`}>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 focus-within:border-zinc-400">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-sm text-zinc-800"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="grid h-5 w-5 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            } else if (e.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={add}
          placeholder={values.length ? '' : placeholder}
          aria-label={label}
          className="min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-zinc-400"
        />
      </div>
    </Field>
  );
};

// add / remove rows of a repeatable section (experience, qualifications, certificates, links)
function Rows<T>({
  items,
  onChange,
  blank,
  noun,
  max,
  render
}: {
  items: T[];
  onChange: (v: T[]) => void;
  blank: T;
  noun: string;
  max: number;
  render: (item: T, set: (patch: Partial<T>) => void, i: number) => React.ReactNode;
}) {
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="relative rounded-xl border border-zinc-200/80 p-4 pr-12">
          {render(
            item,
            (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))),
            i
          )}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"
            aria-label={`Remove ${noun} ${i + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {items.length < max ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...items, blank])}
        >
          <Plus className="h-4 w-4" /> Add {noun}
        </Button>
      ) : null}
    </>
  );
}

const DOMAIN = typeof window === 'undefined' ? '' : window.location.host;

export const ProfileEditorPage: React.FC = () => {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me', 'profile'], queryFn: lmsApi.myProfile });
  const [draft, setDraft] = useState<Profile | null>(null);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  // start editing from the saved profile (once it arrives)
  useEffect(() => {
    if (me.data?.profile && !draft) setDraft(me.data.profile);
  }, [me.data, draft]);

  // username availability, checked as you type (debounced)
  const [checkName, setCheckName] = useState('');
  useEffect(() => {
    const t = window.setTimeout(
      () => setCheckName((draft?.username || '').trim().toLowerCase()),
      400
    );
    return () => window.clearTimeout(t);
  }, [draft?.username]);
  const saved = me.data?.profile;
  const nameCheck = useQuery({
    queryKey: ['username-available', checkName],
    queryFn: () => lmsApi.usernameAvailable(checkName),
    enabled: Boolean(checkName && checkName !== saved?.username)
  });

  const save = useMutation({
    mutationFn: (p: Profile) =>
      lmsApi.updateMyProfile({
        name: p.name,
        username: p.username,
        headline: p.headline,
        location: p.location,
        bio: p.bio,
        phone: p.phone,
        avatar: p.avatar || undefined,
        visibility: p.visibility,
        links: (p.links || []).filter((l) => l.url.trim()),
        skills: p.skills,
        interests: p.interests,
        qualifications: (p.qualifications || []).filter(
          (q) => q.degree.trim() || q.institution.trim()
        ),
        experience: (p.experience || []).filter((e) => e.title.trim() || e.organization.trim()),
        certificates: (p.certificates || []).filter((c) => c.name.trim())
      }),
    onSuccess: (updated) => {
      setDraft(updated);
      qc.invalidateQueries({ queryKey: ['me', 'profile'] });
      qc.invalidateQueries({ queryKey: ['public-profile'] });
    }
  });

  if (me.isLoading || !draft) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-3 py-6 sm:px-6">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d!, ...patch }));
  const username = (draft.username || '').trim().toLowerCase();
  const nameIssue =
    username && username !== saved?.username && nameCheck.data && !nameCheck.data.available
      ? nameCheck.data.reason
      : null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <div className="mx-auto max-w-5xl px-3 pb-28 pt-5 sm:px-6 sm:pt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Your profile</h1>
          <p className="text-sm text-zinc-500">
            Your professional profile, shareable at {DOMAIN}/{saved?.username || 'you'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreview((v) => !v)}>
            <Eye className="h-4 w-4" /> {preview ? 'Edit' : 'Preview'}
          </Button>
          {saved?.username ? (
            <Link to={`/${saved.username}`} target="_blank">
              <Button size="sm" variant="outline">
                <ExternalLink className="h-4 w-4" /> Public page
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {preview ? (
        <ProfileView
          preview
          p={{
            ...draft,
            username: username || 'you',
            isOwner: true,
            stats: undefined as never
          }}
        />
      ) : (
        <div className="space-y-5">
          <Card title="Basics">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  className={input}
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </Field>
              <Field label="Username">
                <div className="flex items-center rounded-xl border border-zinc-200 bg-white focus-within:border-zinc-400">
                  <span className="shrink-0 pl-3 text-sm text-zinc-400">{DOMAIN}/</span>
                  <input
                    className="h-10 min-w-0 flex-1 bg-transparent pr-3 text-sm text-zinc-900 outline-none"
                    value={draft.username || ''}
                    onChange={(e) =>
                      set({ username: e.target.value.toLowerCase().replace(/\s+/g, '-') })
                    }
                    aria-label="Username"
                  />
                  <span className="pr-3">
                    {nameCheck.isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    ) : nameIssue ? (
                      <X className="h-4 w-4 text-red-500" />
                    ) : username ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : null}
                  </span>
                </div>
                {nameIssue ? (
                  <span className="mt-1 block text-xs text-red-600">{nameIssue}</span>
                ) : null}
              </Field>
              <Field label="Headline" className="sm:col-span-2">
                <input
                  className={input}
                  maxLength={120}
                  placeholder="e.g. Backend engineer learning distributed systems"
                  value={draft.headline || ''}
                  onChange={(e) => set({ headline: e.target.value })}
                />
              </Field>
              <Field label="Location">
                <input
                  className={input}
                  maxLength={80}
                  placeholder="City, Country"
                  value={draft.location || ''}
                  onChange={(e) => set({ location: e.target.value })}
                />
              </Field>
              <Field label="Phone (never shown publicly)">
                <input
                  className={input}
                  value={draft.phone || ''}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </Field>
              <Field label="Photo URL" className="sm:col-span-2">
                <input
                  className={input}
                  placeholder="https://…"
                  value={draft.avatar || ''}
                  onChange={(e) => set({ avatar: e.target.value })}
                />
              </Field>
              <Field label="About" className="sm:col-span-2">
                <textarea
                  className={area}
                  rows={4}
                  maxLength={500}
                  value={draft.bio || ''}
                  onChange={(e) => set({ bio: e.target.value })}
                />
              </Field>
              <Field label="Who can see your profile" className="sm:col-span-2">
                <select
                  className={input}
                  value={draft.visibility || 'public'}
                  onChange={(e) => set({ visibility: e.target.value as Profile['visibility'] })}
                >
                  <option value="public">Anyone with the link</option>
                  <option value="members">Signed-in Knowhere members</option>
                  <option value="private">Only me</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card title="Skills and interests">
            <ChipsInput
              label="Skills"
              max={50}
              placeholder="Type a skill and press Enter"
              values={draft.skills || []}
              onChange={(skills) => set({ skills })}
            />
            <ChipsInput
              label="Interests"
              max={30}
              placeholder="e.g. System design"
              values={draft.interests || []}
              onChange={(interests) => set({ interests })}
            />
          </Card>

          <Card title="Work experience">
            <Rows<Experience>
              items={draft.experience || []}
              onChange={(experience) => set({ experience })}
              blank={{
                title: '',
                organization: '',
                startDate: '',
                endDate: '',
                location: '',
                description: ''
              }}
              noun="role"
              max={30}
              render={(e, patch) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Title">
                    <input
                      className={input}
                      value={e.title}
                      onChange={(x) => patch({ title: x.target.value })}
                    />
                  </Field>
                  <Field label="Organization">
                    <input
                      className={input}
                      value={e.organization}
                      onChange={(x) => patch({ organization: x.target.value })}
                    />
                  </Field>
                  <Field label="From">
                    <input
                      type="month"
                      className={input}
                      value={e.startDate || ''}
                      onChange={(x) => patch({ startDate: x.target.value })}
                    />
                  </Field>
                  <Field label="To (empty = present)">
                    <input
                      type="month"
                      className={input}
                      value={e.endDate || ''}
                      onChange={(x) => patch({ endDate: x.target.value })}
                    />
                  </Field>
                  <Field label="What you did" className="sm:col-span-2">
                    <textarea
                      className={area}
                      rows={3}
                      maxLength={1000}
                      value={e.description || ''}
                      onChange={(x) => patch({ description: x.target.value })}
                    />
                  </Field>
                </div>
              )}
            />
          </Card>

          <Card title="Qualifications">
            <Rows<Qualification>
              items={draft.qualifications || []}
              onChange={(qualifications) => set({ qualifications })}
              blank={{ degree: '', institution: '', field: '' }}
              noun="qualification"
              max={20}
              render={(q, patch) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Degree / qualification">
                    <input
                      className={input}
                      value={q.degree}
                      onChange={(x) => patch({ degree: x.target.value })}
                    />
                  </Field>
                  <Field label="Field of study">
                    <input
                      className={input}
                      value={q.field || ''}
                      onChange={(x) => patch({ field: x.target.value })}
                    />
                  </Field>
                  <Field label="Institution" className="sm:col-span-2">
                    <input
                      className={input}
                      value={q.institution}
                      onChange={(x) => patch({ institution: x.target.value })}
                    />
                  </Field>
                  <Field label="Start year">
                    <input
                      type="number"
                      className={input}
                      value={q.startYear || ''}
                      onChange={(x) => patch({ startYear: Number(x.target.value) || undefined })}
                    />
                  </Field>
                  <Field label="End year">
                    <input
                      type="number"
                      className={input}
                      value={q.endYear || ''}
                      onChange={(x) => patch({ endYear: Number(x.target.value) || undefined })}
                    />
                  </Field>
                </div>
              )}
            />
          </Card>

          <Card title="Certificates">
            <Rows<Certificate>
              items={draft.certificates || []}
              onChange={(certificates) => set({ certificates })}
              blank={{ name: '', issuer: '', issuedOn: '', url: '' }}
              noun="certificate"
              max={50}
              render={(c, patch) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <input
                      className={input}
                      value={c.name}
                      onChange={(x) => patch({ name: x.target.value })}
                    />
                  </Field>
                  <Field label="Issuer">
                    <input
                      className={input}
                      value={c.issuer || ''}
                      onChange={(x) => patch({ issuer: x.target.value })}
                    />
                  </Field>
                  <Field label="Issued">
                    <input
                      type="month"
                      className={input}
                      value={c.issuedOn || ''}
                      onChange={(x) => patch({ issuedOn: x.target.value })}
                    />
                  </Field>
                  <Field label="Credential ID">
                    <input
                      className={input}
                      value={c.credentialId || ''}
                      onChange={(x) => patch({ credentialId: x.target.value })}
                    />
                  </Field>
                  <Field label="Verification link" className="sm:col-span-2">
                    <input
                      className={input}
                      placeholder="https://…"
                      value={c.url || ''}
                      onChange={(x) => patch({ url: x.target.value })}
                    />
                  </Field>
                </div>
              )}
            />
          </Card>

          <Card title="Links">
            <Rows<ProfileLink>
              items={draft.links || []}
              onChange={(links) => set({ links })}
              blank={{ label: '', url: '' }}
              noun="link"
              max={8}
              render={(l, patch) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                  <Field label="Label">
                    <input
                      className={input}
                      placeholder="GitHub"
                      value={l.label}
                      onChange={(x) => patch({ label: x.target.value })}
                    />
                  </Field>
                  <Field label="URL">
                    <input
                      className={input}
                      placeholder="https://github.com/you"
                      value={l.url}
                      onChange={(x) => patch({ url: x.target.value })}
                    />
                  </Field>
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {/* save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/70 bg-white/90 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-3 py-3 sm:px-6">
          {saved?.username ? (
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl(saved.username!)).catch(() => {});
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }}
              className="inline-flex min-w-0 items-center gap-2 truncate text-sm text-zinc-500 hover:text-zinc-900"
            >
              {copied ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <Copy className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{copied ? 'Link copied' : shareUrl(saved.username)}</span>
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-3">
            {save.error ? (
              <span className="text-sm text-red-600">{(save.error as Error).message}</span>
            ) : null}
            {save.isSuccess && !dirty ? (
              <span className="text-sm text-emerald-700">Saved</span>
            ) : null}
            <Button
              onClick={() => save.mutate(draft)}
              isLoading={save.isPending}
              disabled={!dirty || Boolean(nameIssue) || !draft.name.trim()}
            >
              Save profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

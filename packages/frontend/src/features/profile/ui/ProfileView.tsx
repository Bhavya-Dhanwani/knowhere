import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  Award,
  BookOpen,
  Briefcase,
  Check,
  ExternalLink,
  GraduationCap,
  Link2,
  MapPin,
  PenLine,
  Share2
} from 'lucide-react';
import { Avatar } from '../../../shared/ui/Avatar';
import { Button } from '../../../shared/ui/Button';
import { PublicProfile } from '../../../shared/api/lms';

const ROLE_LABEL = { trainee: 'Learner', trainer: 'Trainer', admin: 'Admin' } as const;

const monthYear = (ym?: string) =>
  ym
    ? new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric'
      })
    : '';
const span = (from?: string, to?: string) =>
  [monthYear(from), to ? monthYear(to) : from ? 'Present' : ''].filter(Boolean).join(' – ');

export const shareUrl = (username: string) => `${window.location.origin}/${username}`;

const Section: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({
  title,
  icon: Icon,
  children
}) => (
  <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
    <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-900">
      <Icon className="h-4 w-4 text-zinc-500" /> {title}
    </h2>
    {children}
  </section>
);

const Chips: React.FC<{ items: string[] }> = ({ items }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((s) => (
      <span
        key={s}
        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-700"
      >
        {s}
      </span>
    ))}
  </div>
);

// The shareable profile: rendered at domain.com/<username> and as the editor's live preview.
export const ProfileView: React.FC<{ p: PublicProfile; preview?: boolean }> = ({ p, preview }) => {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = shareUrl(p.username);
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) {
        await navigator.share({ title: `${p.name} on Knowhere`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // the user closed the share sheet
    }
  };
  const role = p.role ? ROLE_LABEL[p.role] : undefined;
  const skills = p.skills || [];
  const interests = p.interests || [];
  const experience = p.experience || [];
  const education = p.qualifications || [];
  const certificates = p.certificates || [];

  return (
    <div className="space-y-5">
      {/* header */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
        <div className="h-24 bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500 sm:h-32" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 sm:-mt-14">
            <Avatar
              name={p.name}
              src={p.avatar}
              size="xl"
              className="h-24 w-24 text-2xl ring-4 ring-white sm:h-28 sm:w-28"
            />
            {!preview ? (
              <div className="flex gap-2">
                {p.isOwner ? (
                  <Link to="/profile">
                    <Button size="sm" variant="outline">
                      <PenLine className="h-4 w-4" /> Edit profile
                    </Button>
                  </Link>
                ) : null}
                <Button size="sm" onClick={share}>
                  {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  {copied ? 'Link copied' : 'Share profile'}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {p.name}
            </h1>
            {role ? (
              <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white">
                {role}
              </span>
            ) : null}
          </div>
          {p.headline ? <p className="mt-1 text-base text-zinc-700">{p.headline}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500">
            <span>@{p.username}</span>
            {p.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {p.location}
              </span>
            ) : null}
            {p.memberSince ? (
              <span>
                Member since{' '}
                {new Date(p.memberSince).toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            ) : null}
          </div>
          {p.links?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {p.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <Link2 className="h-3.5 w-3.5" /> {l.label || new URL(l.url).hostname}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {p.bio ? (
            <Section title="About" icon={BookOpen}>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-700">
                {p.bio}
              </p>
            </Section>
          ) : null}

          {experience.length ? (
            <Section title="Experience" icon={Briefcase}>
              <ol className="space-y-5">
                {experience.map((e, i) => (
                  <li key={i} className="relative border-l-2 border-zinc-200 pl-4">
                    <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-zinc-900" />
                    <p className="font-medium text-zinc-900">{e.title}</p>
                    <p className="text-sm text-zinc-600">
                      {e.organization}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                    <p className="text-xs text-zinc-400">{span(e.startDate, e.endDate)}</p>
                    {e.description ? (
                      <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">
                        {e.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {education.length ? (
            <Section title="Qualifications" icon={GraduationCap}>
              <ul className="space-y-4">
                {education.map((q, i) => (
                  <li key={i}>
                    <p className="font-medium text-zinc-900">
                      {q.degree}
                      {q.field ? `, ${q.field}` : ''}
                    </p>
                    <p className="text-sm text-zinc-600">{q.institution}</p>
                    <p className="text-xs text-zinc-400">
                      {[q.startYear, q.endYear].filter(Boolean).join(' – ')}
                      {q.grade ? ` · ${q.grade}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {certificates.length ? (
            <Section title="Certificates" icon={Award}>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {certificates.map((c, i) => (
                  <li key={i} className="rounded-xl border border-zinc-200/80 p-4">
                    <p className="font-medium text-zinc-900">{c.name}</p>
                    <p className="text-sm text-zinc-600">{c.issuer}</p>
                    <p className="text-xs text-zinc-400">
                      {monthYear(c.issuedOn)}
                      {c.credentialId ? ` · ID ${c.credentialId}` : ''}
                    </p>
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-2 inline-flex items-center gap-1 text-sm text-zinc-900 underline-offset-2 hover:underline"
                      >
                        Verify <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {!p.bio && !experience.length && !education.length && !certificates.length ? (
            <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-500">
              {p.isOwner || preview
                ? 'Add an about section, experience, qualifications and certificates to fill your profile.'
                : 'This profile is still being filled in.'}
            </p>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-5">
          {p.stats ? (
            <section className="grid grid-cols-2 gap-3">
              {[
                ['Learning', p.stats.learning],
                ['Teaching', p.stats.teaching]
              ].map(([label, n]) => (
                <div key={label} className="rounded-2xl border border-zinc-200/80 bg-white p-4">
                  <p className="text-2xl font-semibold tabular-nums text-zinc-900">{n}</p>
                  <p className="text-xs text-zinc-500">{label} · courses</p>
                </div>
              ))}
            </section>
          ) : null}
          {skills.length ? (
            <Section title="Skills" icon={Check}>
              <Chips items={skills} />
            </Section>
          ) : null}
          {interests.length ? (
            <Section title="Interests" icon={BookOpen}>
              <Chips items={interests} />
            </Section>
          ) : null}
        </aside>
      </div>
    </div>
  );
};

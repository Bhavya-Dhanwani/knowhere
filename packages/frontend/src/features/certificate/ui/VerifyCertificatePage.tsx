import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Copy, Printer, SearchCheck, ShieldX } from 'lucide-react';
import { RootState } from '../../../app/store';
import { lmsApi } from '../../../shared/api/lms';
import { Logo } from '../../../shared/ui/Logo';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { CertificateView, verifyUrl } from './CertificateView';

const day = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

// printing (or "Save as PDF") outputs only the certificate, one A4 landscape page
const PRINT_CSS = `@media print {
  @page { size: A4 landscape; margin: 0; }
  body * { visibility: hidden; }
  #certificate, #certificate * { visibility: visible; }
  #certificate { position: fixed; inset: 0; width: 100vw; }
}`;

// domain.com/verify/<code>: anyone (signed out too) can check a certificate is genuine. The QR code
// printed on every certificate opens this page; /verify alone lets people type an ID in.
export const VerifyCertificatePage: React.FC = () => {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const signedIn = useSelector((s: RootState) => s.auth.isAuthenticated);
  const [input, setInput] = useState(code);
  const [copied, setCopied] = useState(false);
  const q = useQuery({
    queryKey: ['certificate', code.toUpperCase()],
    queryFn: () => lmsApi.verifyCertificate(code),
    enabled: !!code,
    retry: false
  });
  const c = q.data;

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <style>{PRINT_CSS}</style>
      <header className="border-b border-zinc-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <Link to={signedIn ? '/dashboard' : '/login'}>
            <Button size="sm" variant={signedIn ? 'outline' : 'primary'}>
              {signedIn ? 'Dashboard' : 'Sign in'}
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <form
          className="flex flex-col gap-2 rounded-2xl border border-zinc-200/80 bg-white p-4 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const id = input.trim().toUpperCase();
            if (id) navigate(`/verify/${id}`);
          }}
        >
          <div className="flex-1">
            <Input
              label="Certificate ID"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 9F2C-41AB-07DE-66B3"
              className="font-mono"
            />
          </div>
          <Button type="submit">
            <SearchCheck className="h-4 w-4" /> Verify
          </Button>
        </form>

        {!code ? (
          <p className="text-center text-sm text-zinc-500">
            Enter the ID printed on a Knowhere certificate, or scan its QR code.
          </p>
        ) : q.isLoading ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : c ? (
          <>
            <section
              className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-emerald-900">Verified certificate</p>
                  <p className="mt-0.5 text-sm text-emerald-800">
                    Knowhere issued this certificate. The details below come from our records, not
                    from the document itself.
                  </p>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {[
                      ['Awarded to', c.learnerName],
                      ['Course', c.courseTitle],
                      ['Score', `${c.percentage}%`],
                      ['Completed', day(c.completedAt)],
                      ['Issued', day(c.issuedAt)],
                      ['Signed by', c.signerName],
                      ['Certificate ID', c.code]
                    ].map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-emerald-700">{k}</dt>
                        <dd className="break-words font-medium text-zinc-900">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigator.clipboard.writeText(verifyUrl(c.code)).then(() => setCopied(true))
                }
              >
                <Copy className="h-4 w-4" /> {copied ? 'Link copied' : 'Copy link'}
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print / save PDF
              </Button>
            </div>

            <CertificateView c={c} />
          </>
        ) : !/no certificate/i.test((q.error as Error)?.message || '') ? (
          // an outage must never read as "fake certificate"
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 text-center">
            <p className="font-semibold text-zinc-900">
              Couldn&apos;t check this certificate right now
            </p>
            <p className="mt-1 text-sm text-zinc-500">{(q.error as Error)?.message}</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => q.refetch()}>
              Try again
            </Button>
          </section>
        ) : (
          <section className="rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center">
            <ShieldX className="mx-auto h-10 w-10 text-red-500" />
            <p className="mt-3 font-semibold text-red-900">Not a valid certificate</p>
            <p className="mt-1 text-sm text-red-800">
              No Knowhere certificate has the ID <span className="font-mono">{code}</span>. Check it
              was typed exactly, or ask the holder for their verification link.
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

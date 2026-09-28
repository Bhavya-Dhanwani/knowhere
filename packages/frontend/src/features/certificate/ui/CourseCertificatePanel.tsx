import React from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, BadgeCheck, ExternalLink, UserPlus } from 'lucide-react';
import { lmsApi, IssuedCertificate } from '../../../shared/api/lms';
import { Button } from '../../../shared/ui/Button';
import { verifyUrl } from './CertificateView';

// Learner's certificate box on the course page. `completedCount` is part of the query key, so
// finishing the last item refreshes eligibility without a reload.
export const CourseCertificatePanel: React.FC<{ courseId: string; completedCount: number }> = ({
  courseId,
  completedCount
}) => {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['certificate-status', courseId, completedCount],
    queryFn: () => lmsApi.certificateStatus(courseId)
  });
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: lmsApi.myProfile });

  const claim = useMutation({
    mutationFn: () => lmsApi.claimCertificate(courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certificate-status', courseId] })
  });

  // the profile's certificates section gets the verifiable link
  const addToProfile = useMutation({
    mutationFn: (c: IssuedCertificate) =>
      lmsApi.updateMyProfile({
        certificates: [
          ...(profile.data?.profile?.certificates || []),
          {
            name: c.courseTitle,
            issuer: 'Knowhere',
            issuedOn: c.issuedAt.slice(0, 7),
            credentialId: c.code,
            url: verifyUrl(c.code)
          }
        ]
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'profile'] })
  });

  const s = status.data;
  if (!s) return null;
  const cert = s.certificate;
  const onProfile =
    !!cert && profile.data?.profile?.certificates?.some((p) => p.credentialId === cert.code);
  const error = (claim.error || addToProfile.error) as Error | null;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-200/80 p-4 sm:flex-row sm:items-center">
      {cert ? (
        <BadgeCheck className="h-6 w-6 shrink-0 text-emerald-600" />
      ) : (
        <Award className="h-6 w-6 shrink-0 text-zinc-400" />
      )}
      <div className="min-w-0 flex-1 text-sm">
        {cert ? (
          <>
            <p className="font-medium text-zinc-900">You earned the certificate</p>
            <p className="text-zinc-500">
              ID <span className="font-mono">{cert.code}</span> · anyone can verify it from its QR
              code or link
            </p>
          </>
        ) : s.eligible ? (
          <>
            <p className="font-medium text-zinc-900">Course complete: claim your certificate</p>
            <p className="text-zinc-500">
              {s.hasSigner
                ? 'It carries your name, the course and the course admin’s signature.'
                : 'Waiting for the course admin to add their signature.'}
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-zinc-900">Certificate of completion</p>
            <p className="text-zinc-500">
              Complete every item to earn it ({s.completedItems}/{s.totalItems} done).
            </p>
          </>
        )}
        {error ? <p className="mt-1 text-red-600">{error.message}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {cert ? (
          <>
            <Link to={`/verify/${cert.code}`}>
              <Button size="sm">
                <ExternalLink className="h-4 w-4" /> View certificate
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              disabled={onProfile || !profile.data}
              isLoading={addToProfile.isPending}
              onClick={() => addToProfile.mutate(cert)}
            >
              <UserPlus className="h-4 w-4" /> {onProfile ? 'On your profile' : 'Add to profile'}
            </Button>
          </>
        ) : s.eligible ? (
          <Button
            size="sm"
            disabled={!s.hasSigner}
            isLoading={claim.isPending}
            onClick={() => claim.mutate()}
          >
            <Award className="h-4 w-4" /> Get certificate
          </Button>
        ) : null}
      </div>
    </div>
  );
};

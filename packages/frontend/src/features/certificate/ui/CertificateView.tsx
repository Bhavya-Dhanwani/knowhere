import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { IssuedCertificate } from '../../../shared/api/lms';
import { Logo } from '../../../shared/ui/Logo';

export const verifyUrl = (code: string) => `${window.location.origin}/verify/${code}`;

const day = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

// The certificate as printed / saved to PDF. Its QR code opens the public verification page.
export const CertificateView: React.FC<{ c: IssuedCertificate }> = ({ c }) => {
  const [qr, setQr] = useState<string | null>(null);
  const url = verifyUrl(c.code);

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 0, width: 240, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);

  return (
    <article
      id="certificate"
      className="relative mx-auto aspect-[1.414/1] w-full max-w-5xl overflow-hidden bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 print:max-w-none print:shadow-none print:ring-0"
      style={{ containerType: 'inline-size' }}
    >
      {/* sizes use container units so the layout scales identically on screen, phone and paper */}
      <div className="absolute inset-[2.2cqw] border-[0.35cqw] border-double border-zinc-800" />
      <div className="absolute inset-[3.1cqw] border border-zinc-300" />

      <div className="relative flex h-full flex-col items-center px-[8cqw] pt-[6cqw] text-center">
        <div style={{ fontSize: '1.4cqw' }}>
          <Logo size="sm" />
        </div>
        <p
          className="mt-[2.4cqw] font-semibold uppercase tracking-[0.3em] text-zinc-500"
          style={{ fontSize: '1.3cqw' }}
        >
          Certificate of completion
        </p>
        <p className="mt-[3cqw] text-zinc-600" style={{ fontSize: '1.6cqw' }}>
          This certifies that
        </p>
        <h1
          className="mt-[1cqw] font-serif font-semibold tracking-tight"
          style={{ fontSize: '4.6cqw', lineHeight: 1.1 }}
        >
          {c.learnerName}
        </h1>
        <div className="mt-[1.2cqw] h-px w-[40cqw] bg-zinc-300" />
        <p className="mt-[1.8cqw] text-zinc-600" style={{ fontSize: '1.6cqw' }}>
          has successfully completed the course
        </p>
        <h2
          className="mt-[0.8cqw] max-w-[70cqw] font-semibold"
          style={{ fontSize: '2.7cqw', lineHeight: 1.2 }}
        >
          {c.courseTitle}
        </h2>
        <p className="mt-[1.2cqw] text-zinc-600" style={{ fontSize: '1.4cqw' }}>
          with a score of <b className="text-zinc-900">{c.percentage}%</b>, completed on{' '}
          <b className="text-zinc-900">{day(c.completedAt)}</b>
        </p>

        <div className="mt-auto mb-[5.5cqw] grid w-full grid-cols-3 items-end">
          <div className="text-left" style={{ fontSize: '1.2cqw' }}>
            <p className="text-zinc-500">Issued</p>
            <p className="font-medium">{day(c.issuedAt)}</p>
            <p className="mt-[0.8cqw] text-zinc-500">Certificate ID</p>
            <p className="font-mono font-medium">{c.code}</p>
          </div>

          <div className="flex flex-col items-center">
            <img
              src={c.signature}
              alt={`Signature of ${c.signerName}`}
              className="h-[7cqw] w-auto object-contain"
            />
            <div className="h-px w-[22cqw] bg-zinc-800" />
            <p className="mt-[0.6cqw] font-semibold" style={{ fontSize: '1.4cqw' }}>
              {c.signerName}
            </p>
            <p className="text-zinc-500" style={{ fontSize: '1.2cqw' }}>
              Authorized Signatory
            </p>
          </div>

          <div className="flex flex-col items-end" style={{ fontSize: '1cqw' }}>
            {qr ? (
              <img
                src={qr}
                alt="QR code to verify this certificate"
                className="h-[10cqw] w-[10cqw]"
              />
            ) : (
              <div className="h-[10cqw] w-[10cqw] bg-zinc-100" />
            )}
            <p className="mt-[0.6cqw] text-zinc-500">Scan to verify</p>
          </div>
        </div>
      </div>
    </article>
  );
};

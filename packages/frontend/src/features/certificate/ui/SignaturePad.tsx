import React, { useEffect, useRef, useState } from 'react';
import { Eraser, Upload } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';

const W = 480;
const H = 160;

// Draw (mouse, touch, pen) or upload a signature. Emits a transparent PNG data URL, or null when
// cleared. Everything is redrawn into one small canvas, so the upload stays well under the API limit.
export const SignaturePad: React.FC<{
  value: string | null;
  onChange: (png: string | null) => void;
}> = ({ value, onChange }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const ctx = () => {
    const c = canvas.current!.getContext('2d')!;
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#111827';
    return c;
  };

  // show an existing signature (e.g. when editing a course)
  useEffect(() => {
    if (!value || !canvas.current) return;
    const img = new Image();
    img.onload = () => {
      const c = ctx();
      c.clearRect(0, 0, W, H);
      c.drawImage(img, 0, 0, W, H);
    };
    img.src = value;
    // only on mount: afterwards the canvas is the source of truth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as const;
  };

  const clear = () => {
    ctx().clearRect(0, 0, W, H);
    onChange(null);
  };

  const upload = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file.');
    const img = new Image();
    img.onload = () => {
      const c = ctx();
      c.clearRect(0, 0, W, H);
      // fit inside the pad, keeping the aspect ratio
      const s = Math.min(W / img.width, H / img.height);
      const w = img.width * s;
      const h = img.height * s;
      c.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      URL.revokeObjectURL(img.src);
      // scans and photos: paper becomes transparent, strokes become ink (also keeps the PNG tiny)
      const px = c.getImageData(0, 0, W, H);
      for (let i = 0; i < px.data.length; i += 4) {
        const dark =
          (px.data[i] + px.data[i + 1] + px.data[i + 2]) / 3 < 150 && px.data[i + 3] > 64;
        px.data.set(dark ? [17, 24, 39, 255] : [0, 0, 0, 0], i);
      }
      c.putImageData(px, 0, 0);
      onChange(canvas.current!.toDataURL('image/png'));
    };
    img.onerror = () => setError('That image could not be read.');
    img.src = URL.createObjectURL(file);
  };

  return (
    <div>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        aria-label="Signature pad: draw your signature"
        className="block aspect-[3/1] w-full touch-none rounded-xl bg-white ring-1 ring-inset ring-zinc-200 [background-image:linear-gradient(to_top,transparent_28%,#e4e4e7_28%,#e4e4e7_calc(28%+1px),transparent_calc(28%+1px))]"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const c = ctx();
          const [x, y] = point(e);
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + 0.1, y + 0.1);
          c.stroke();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const [x, y] = point(e);
          const c = ctx();
          c.lineTo(x, y);
          c.stroke();
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          onChange(canvas.current!.toDataURL('image/png'));
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={clear}>
          <Eraser className="h-4 w-4" /> Clear
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50">
          <Upload className="h-4 w-4" /> Upload image
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
        <span className="text-xs text-zinc-500">
          {value ? 'Signature captured' : 'Draw above, or upload a scan'}
        </span>
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
};

// the certificate's signer: any name (instructor, admin, trainer...) + their signature.
// The certificate itself shows only this name above a fixed "Authorized Signatory" line.
export const SignerFields: React.FC<{
  name: string;
  onName: (v: string) => void;
  signature: string | null;
  onSignature: (png: string | null) => void;
}> = ({ name, onName, signature, onSignature }) => (
  <div className="space-y-3">
    <Input
      label="Name on the certificate"
      value={name}
      onChange={(e) => onName(e.target.value)}
      placeholder="e.g. Dr. Priya Sharma, Rahul Verma, Ananya Iyer"
      maxLength={80}
      required
    />
    <p className="-mt-2 text-xs text-zinc-500">
      Any instructor, admin or trainer can sign. Only the name is printed, as the Authorized
      Signatory.
    </p>
    <SignaturePad value={signature} onChange={onSignature} />
  </div>
);

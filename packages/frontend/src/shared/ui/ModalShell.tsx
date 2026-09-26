import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { cn } from '../lib/cn';

const widths = {
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl'
};

// Bare animated dialog frame for screens that render their own header/body.
// Bottom sheet on phones, centred card from `sm`; Escape and backdrop click close it.
export const ModalShell: React.FC<{
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof widths;
  dark?: boolean;
  label?: string;
}> = ({ onClose, children, size = '3xl', dark, label }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        className="absolute inset-0 bg-zinc-950/45 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className={cn(
          'relative z-10 flex max-h-[94dvh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-3xl shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl',
          dark ? 'bg-slate-900 text-slate-100' : 'bg-white text-zinc-900',
          widths[size]
        )}
      >
        {children}
      </motion.div>
    </div>,
    document.body
  );
};

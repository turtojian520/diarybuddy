'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** max height as viewport fraction, 0–1. Default 0.85 */
  maxHeightRatio?: number;
};

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeightRatio = 0.85,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof window === 'undefined') return null;

  const content = (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity"
      />
      <div
        ref={sheetRef}
        className="relative w-full max-w-xl animate-[sheet-in_220ms_ease-out] rounded-t-3xl border border-[var(--db-border)] bg-[var(--db-bg)] shadow-[0_-12px_40px_rgba(43,42,39,0.18)]"
        style={{
          maxHeight: `${Math.round(maxHeightRatio * 100)}vh`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex justify-center pt-3">
          <span className="h-1 w-10 rounded-full bg-[var(--db-border)]" aria-hidden />
        </div>
        {title ? (
          <div className="px-5 pt-2 pb-1 text-[15px] font-medium text-[var(--db-ink)]">
            {title}
          </div>
        ) : null}
        <div className="overflow-y-auto px-5 pb-5 pt-2">{children}</div>
      </div>
      <style>{`
        @keyframes sheet-in {
          from { transform: translateY(12%); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}

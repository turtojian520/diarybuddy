'use client';

import { Feather, Plus } from 'lucide-react';

type Props = {
  onOpen: () => void;
  /** 1-based index of the next fragment — used for placeholder copy. */
  nextIndex?: number;
};

export function MobileQuickInputBar({ onOpen, nextIndex }: Props) {
  const placeholder =
    typeof nextIndex === 'number' && nextIndex > 0
      ? `写下第 ${nextIndex} 条碎片……`
      : '写下一条碎片……';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="打开写碎片输入"
      className="fixed inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)] z-30 flex items-center gap-3 rounded-full border border-[var(--db-border)] bg-[var(--db-bg)] px-4 py-2.5 text-left shadow-[0_8px_24px_rgba(43,42,39,0.12)] md:hidden"
    >
      <Feather className="h-4 w-4 shrink-0 text-[var(--db-accent-deep)]" aria-hidden />
      <span className="flex-1 truncate text-sm italic text-[var(--db-faint)]">
        {placeholder}
      </span>
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--db-accent)] text-white shadow-[0_4px_12px_rgba(212,163,115,0.35)]"
      >
        <Plus className="h-4 w-4" />
      </span>
    </button>
  );
}

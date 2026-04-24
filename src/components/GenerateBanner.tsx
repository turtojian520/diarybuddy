'use client';

import { Loader2, Sparkles } from 'lucide-react';

const MIN_FRAGMENTS = 3;

type Props = {
  count: number;
  isGenerating: boolean;
  onGenerate: () => void;
  /** Render compact variant without the descriptive subtitle. */
  compact?: boolean;
};

export function GenerateBanner({ count, isGenerating, onGenerate, compact }: Props) {
  const ready = count >= MIN_FRAGMENTS;
  const remaining = Math.max(0, MIN_FRAGMENTS - count);

  return (
    <div
      role="region"
      aria-label="生成日记"
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
        ready
          ? 'border-[var(--db-border-soft)] bg-[var(--db-surface-2)]'
          : 'border-[var(--db-border)] bg-[var(--db-surface)]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--db-muted)]">
          今日进度
        </p>
        <p className="mt-0.5 text-sm text-[var(--db-ink)]">
          <span className="font-semibold">已收集 {count} 条</span>
          {!compact && (
            <span className="text-[var(--db-muted)]">
              {' '}
              {ready
                ? '· 可以让 AI 整理成日记了'
                : `· 再写 ${remaining} 条就能生成`}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={!ready || isGenerating}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
          ready
            ? 'bg-[var(--db-accent)] text-white shadow-[0_4px_14px_rgba(212,163,115,0.3)] hover:bg-[var(--db-accent-dim)]'
            : 'bg-[var(--db-border)] text-[var(--db-muted)]'
        } disabled:opacity-60`}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden />
        )}
        <span>{isGenerating ? '生成中…' : '生成日记'}</span>
      </button>
    </div>
  );
}

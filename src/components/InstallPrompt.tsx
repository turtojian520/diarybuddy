'use client';

import { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

const DISMISS_KEY = 'db-install-dismissed-at';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function readDismissedAt(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    const at = Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

function writeDismissedAt(at: number) {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(at));
  } catch {
    // storage may be unavailable (private mode); non-fatal.
  }
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}

function derivePlatform(fragmentCount: number, dismissedAt: number | null): 'android' | 'ios' | null {
  if (typeof window === 'undefined') return null;
  if (fragmentCount < 3) return null;
  if (isStandalone()) return null;
  if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return null;
  const hasNative = Boolean(
    (window as unknown as { __dbInstallPrompt?: InstallPromptEvent }).__dbInstallPrompt,
  );
  if (hasNative) return 'android';
  if (detectIos()) return 'ios';
  return null;
}

type Props = {
  /** Current fragment count for the day. Must be ≥3 to show the prompt. */
  fragmentCount: number;
};

export function InstallPrompt({ fragmentCount }: Props) {
  const [dismissedAt, setDismissedAt] = useState<number | null>(() => readDismissedAt());
  const platform = derivePlatform(fragmentCount, dismissedAt);
  const open = platform !== null;

  async function handleInstall() {
    const evt = (window as unknown as { __dbInstallPrompt?: InstallPromptEvent }).__dbInstallPrompt;
    const now = Date.now();
    if (!evt) {
      writeDismissedAt(now);
      setDismissedAt(now);
      return;
    }
    try {
      await evt.prompt();
      await evt.userChoice;
    } catch {
      // Dismissed or already consumed.
    }
    (window as unknown as { __dbInstallPrompt?: InstallPromptEvent }).__dbInstallPrompt = undefined;
    writeDismissedAt(now);
    setDismissedAt(now);
  }

  function handleDismiss() {
    const now = Date.now();
    writeDismissedAt(now);
    setDismissedAt(now);
  }

  if (!platform) return null;

  return (
    <BottomSheet open={open} onClose={handleDismiss} title="把 Diarybuddy 装进口袋">
      <div className="space-y-4 pt-1 text-[15px] leading-relaxed text-[var(--db-ink-2)]">
        <p>
          你已经累计写了 <strong className="text-[var(--db-ink)]">{fragmentCount}</strong> 条碎片。
          把 Diarybuddy 添加到主屏幕后，打开它就像打开一个独立 App —— 更快、更沉浸，离线也能用。
        </p>

        {platform === 'android' ? (
          <div className="rounded-xl border border-[var(--db-border)] bg-[var(--db-surface)] px-4 py-3 text-sm">
            <p className="text-[var(--db-muted)]">一键安装：</p>
            <p className="mt-1 text-[var(--db-ink)]">点击下方「添加到主屏」即可。</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--db-border)] bg-[var(--db-surface)] px-4 py-3 text-sm">
            <p className="text-[var(--db-muted)]">iOS 安装步骤：</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--db-ink)]">
              <li>
                点击 Safari 底部 <Share className="inline h-3.5 w-3.5 align-[-2px]" /> 分享按钮
              </li>
              <li>选择「添加到主屏幕」</li>
              <li>确认名称并添加</li>
            </ol>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full px-4 py-2 text-sm text-[var(--db-muted)]"
          >
            稍后再说
          </button>
          {platform === 'android' ? (
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--db-accent)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_4px_14px_rgba(212,163,115,0.3)] transition-colors hover:bg-[var(--db-accent-dim)]"
            >
              <Download className="h-4 w-4" aria-hidden />
              添加到主屏
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--db-accent)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_4px_14px_rgba(212,163,115,0.3)] transition-colors hover:bg-[var(--db-accent-dim)]"
            >
              我知道了
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

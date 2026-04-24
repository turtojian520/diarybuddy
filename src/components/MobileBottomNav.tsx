'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpenText, History, Settings } from 'lucide-react';

const items = [
  { href: '/', label: '工作台', icon: BookOpenText, match: (p: string) => p === '/' },
  { href: '/history', label: '归档', icon: History, match: (p: string) => p.startsWith('/history') },
  { href: '/settings', label: '设置', icon: Settings, match: (p: string) => p.startsWith('/settings') },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t border-[var(--db-border)] bg-[var(--db-bg)]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname ?? '');
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
              active
                ? 'text-[var(--db-accent-deep)]'
                : 'text-[var(--db-muted)] hover:text-[var(--db-ink)]'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

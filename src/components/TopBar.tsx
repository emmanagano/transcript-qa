'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompare } from '@/lib/compare-store';
import { LogoMark } from './Logo';

const NAV = [
  { href: '/upload', label: 'Upload' },
  { href: '/stats', label: 'Stats' },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, session } = useAuth();
  const { setCurrent } = useCompare();
  const name = profile?.full_name || session?.user.email?.split('@')[0] || '';
  const onAccount = pathname.startsWith('/account');

  const logOut = async () => {
    setCurrent(null);
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <header className="p-4">
      <nav aria-label="Main" className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-white px-5 py-2">
        <Link href="/upload" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
          <LogoMark />
          <span className="font-heading text-lg font-bold">TranscriptQA</span>
        </Link>
        <div className="flex gap-1">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-10 items-center rounded-xl px-4 text-[15px] no-underline ${
                  active ? 'bg-tint font-bold text-brand-dark hover:text-brand-dark' : 'font-medium text-muted hover:bg-chip hover:text-ink'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-4">
          {/* the name opens the Account page (edit name, change password, reset data) */}
          <Link
            href="/account"
            aria-current={onAccount ? 'page' : undefined}
            aria-label={`Account settings: ${name}`}
            title="Account settings"
            className={`group flex min-h-10 items-center gap-2 rounded-full border-[1.5px] py-1 pl-1 pr-3 text-sm font-semibold no-underline transition-colors ${
              onAccount
                ? 'border-brand bg-tint text-brand-dark hover:text-brand-dark'
                : 'border-line bg-white text-ink hover:border-brand hover:bg-tint-soft hover:text-ink'
            }`}
          >
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-tint text-[13px] font-bold text-brand-dark">
              {name.slice(0, 1).toUpperCase()}
            </span>
            {name}
            {profile?.role === 'senior' && <span className="rounded-full bg-chip px-2 py-0.5 text-xs font-semibold text-ink">Senior</span>}
            {/* gear: tells people this opens their account settings */}
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 ${onAccount ? 'text-brand-dark' : 'text-muted group-hover:text-brand'}`}
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          <button onClick={logOut} className="min-h-11 px-1 text-sm font-medium text-brand hover:text-brand-dark">
            Log out
          </button>
        </div>
      </nav>
    </header>
  );
}

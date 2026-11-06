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
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-tint text-[13px] font-bold text-brand-dark">
              {name.slice(0, 1).toUpperCase()}
            </span>
            {name}
            {profile?.role === 'senior' && <span className="rounded-full bg-chip px-2 py-0.5 text-xs font-semibold text-ink">Senior</span>}
          </span>
          <button onClick={logOut} className="min-h-11 px-1 text-sm font-medium text-brand hover:text-brand-dark">
            Log out
          </button>
        </div>
      </nav>
    </header>
  );
}

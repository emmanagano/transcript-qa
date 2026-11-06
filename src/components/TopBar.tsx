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
    <header className="border-b border-line bg-white">
      <nav aria-label="Main" className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-2 px-6">
        <Link href="/upload" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
          <LogoMark />
          <span className="text-lg font-extrabold">TranscriptQA</span>
        </Link>
        <div className="flex self-stretch">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center border-b-[3px] px-4 text-[15px] no-underline ${
                  active ? 'border-brand font-bold text-ink hover:text-ink' : 'border-transparent font-medium text-muted hover:text-ink'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-senior text-[13px] font-bold text-white">
              {name.slice(0, 1).toUpperCase()}
            </span>
            {name}
            {profile?.role === 'senior' && <span className="rounded-full bg-line px-2 py-0.5 text-xs font-semibold text-ink">Senior</span>}
          </span>
          <button onClick={logOut} className="min-h-11 px-1 text-sm font-medium text-brand hover:text-brand-dark">
            Log out
          </button>
        </div>
      </nav>
    </header>
  );
}

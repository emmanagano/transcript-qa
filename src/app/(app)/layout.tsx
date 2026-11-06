'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { TopBar } from '@/components/TopBar';
import { Spinner } from '@/components/Spinner';

/** Every screen after login: needs a session, and shows the top bar. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, session, needsPassword } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/login');
    else if (needsPassword) router.replace('/set-password');
  }, [loading, session, needsPassword, router]);

  if (loading || !session) return <Spinner label="Loading" />;

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto flex max-w-[1200px] flex-col gap-7 px-6 pb-16 pt-8">{children}</main>
    </div>
  );
}

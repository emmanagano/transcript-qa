'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/Spinner';

export default function Home() {
  const router = useRouter();
  const { loading, session, needsPassword } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (needsPassword && session) router.replace('/set-password');
    else router.replace(session ? '/upload' : '/login');
  }, [loading, session, needsPassword, router]);

  return <Spinner label="Loading" />;
}

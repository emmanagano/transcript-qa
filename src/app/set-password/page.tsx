'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LogoMark } from '@/components/Logo';
import { Spinner } from '@/components/Spinner';

const input = 'h-12 w-full border border-field bg-white px-3.5 text-base text-ink';

/** Where invite and password-reset links land. */
export default function SetPasswordPage() {
  const router = useRouter();
  const { loading, session, profile, refreshProfile, clearNeedsPassword } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name);
  }, [profile]);

  if (loading) return <Spinner label="Checking your link" />;

  if (!session) {
    return (
      <main className="mx-auto flex max-w-[440px] flex-col gap-4 px-6 py-24">
        <h1 className="text-2xl font-extrabold">This link has expired</h1>
        <p className="text-muted">Invite and reset links only work once and for a limited time. Ask for a new invite, or request a new reset link from the login page.</p>
        <a href="/login" className="font-semibold">Go to log in</a>
      </main>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (name.trim() && name.trim() !== profile?.full_name) {
      await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', session.user.id);
      await refreshProfile();
    }
    clearNeedsPassword();
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
    router.replace('/upload');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-[440px] flex-col justify-center gap-8 px-6 py-16">
      <div className="flex items-center gap-3">
        <LogoMark size={12} />
        <span className="text-xl font-extrabold">TranscriptQA</span>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Set your password</h1>
          <p className="text-muted">Signed in as {session.user.email}</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-semibold">Your name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown on the team stats" className={input} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="pw" className="text-sm font-semibold">New password</label>
          <input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="pw2" className="text-sm font-semibold">Confirm password</label>
          <input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
        </div>
        {error && <p role="alert" className="border border-[#C62F46] bg-del-bg px-4 py-3 text-sm text-del-fg">{error}</p>}
        <button type="submit" disabled={busy} className="h-12 bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-60">
          {busy ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </main>
  );
}

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LogoMark } from '@/components/Logo';

const input =
  'h-12 w-full rounded-xl border border-field bg-white px-3.5 text-base text-ink placeholder:text-muted/70';

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, needsPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) router.replace(needsPassword ? '/set-password' : '/upload');
  }, [loading, session, needsPassword, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message === 'Invalid login credentials' ? 'That email and password don’t match.' : error.message);
      else router.replace('/upload');
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (error) setError(error.message);
      else setNotice('If that email has an account, a reset link is on its way.');
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen flex-wrap">
      <section className="flex min-w-0 flex-[1_1_520px] flex-col justify-between gap-12 bg-brand px-8 py-16 text-white sm:px-14">
        <div className="flex items-center gap-3">
          <LogoMark size={12} />
          <span className="font-heading text-xl font-bold tracking-tight">TranscriptQA</span>
        </div>
        <div className="flex max-w-[520px] flex-col gap-6">
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
            See how accurate you are, and how much work you put in.
          </h1>
          <p className="text-lg leading-relaxed text-white/85">
            Compare your transcript with the QA&apos;s version and the AI template. Every fix you make gets counted.
          </p>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <span className="rounded-full bg-white/15 px-3.5 py-1.5">Accuracy</span>
            <span className="rounded-full bg-white/15 px-3.5 py-1.5">Effort</span>
            <span className="rounded-full bg-white/15 px-3.5 py-1.5">Team stats</span>
          </div>
        </div>
        <div aria-hidden="true" className="flex max-w-[520px] flex-col gap-2">
          <span className="h-3 w-full rounded-full bg-white/90" />
          <span className="h-3 w-2/3 rounded-full bg-white/45" />
          <span className="h-3 w-5/6 rounded-full bg-white/90" />
        </div>
      </section>

      <section className="flex min-w-0 flex-[1_1_520px] items-center justify-center px-6 py-16">
        <form onSubmit={submit} className="flex w-full max-w-[400px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold tracking-tight">{mode === 'login' ? 'Log in' : 'Reset password'}</h2>
            <p className="text-muted">
              {mode === 'login' ? 'Welcome back. Pick up where you left off.' : 'We’ll email you a link to set a new password.'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-semibold">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} />
          </div>

          {mode === 'login' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor="password" className="text-sm font-semibold">Password</label>
                <button type="button" onClick={() => { setMode('reset'); setError(null); }} className="text-sm font-medium text-brand hover:text-brand-dark">
                  Forgot password?
                </button>
              </div>
              <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
            </div>
          )}

          {error && <p role="alert" className="rounded-xl border border-[#F2B8B0] bg-del-bg px-4 py-3 text-sm text-del-fg">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-ins-line bg-ins-bg px-4 py-3 text-sm text-ins-fg">{notice}</p>}

          <button type="submit" disabled={busy} className="h-12 rounded-xl bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-60">
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Send reset link'}
          </button>

          {mode === 'reset' && (
            <button type="button" onClick={() => { setMode('login'); setNotice(null); setError(null); }} className="text-sm font-medium text-brand hover:text-brand-dark">
              ← Back to log in
            </button>
          )}

          <p className="rounded-xl border border-line bg-white px-4 py-3.5 text-sm leading-relaxed text-muted">
            Accounts are invite-only. No account yet? Ask your senior transcriber to send you an invite.
          </p>
        </form>
      </section>
    </div>
  );
}

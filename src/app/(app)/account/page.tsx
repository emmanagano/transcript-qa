'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useCompare } from '@/lib/compare-store';
import { supabase } from '@/lib/supabase';
import { deleteMyResults } from '@/lib/results-db';
import type { Mode } from '@/lib/compare/engine';
import { Card, buttonPrimary, labelSmall } from '@/components/ui';

const input = 'h-12 w-full rounded-xl border border-field bg-white px-3.5 text-base text-ink';
const NAME_MAX = 80;

/** Red box for errors, green box for success. */
function Message({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) {
  return kind === 'error' ? (
    <p role="alert" className="rounded-xl border border-del-line bg-del-bg px-4 py-3 text-sm text-del-fg">{children}</p>
  ) : (
    <p role="status" className="rounded-xl border border-ins-line bg-ins-bg px-4 py-3 text-sm text-ins-fg">{children}</p>
  );
}

type Msg = { kind: 'error' | 'ok'; text: string } | null;

export default function AccountPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-bold tracking-tight">Account</h1>
        <p className="text-muted">Your name, your password, and the scores you’ve saved.</p>
      </div>
      <NameCard />
      <PasswordCard />
      <ResetCard />
    </div>
  );
}

// ---------------------------------------------------------------- name

function NameCard() {
  const { session, profile, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    if (profile) setName(profile.full_name);
  }, [profile]);

  const trimmed = name.trim();
  const canSave = !!trimmed && trimmed !== profile?.full_name && !busy;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || !canSave) return;
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.from('profiles').update({ full_name: trimmed }).eq('id', session.user.id).select('id');
    if (error || !data?.length) {
      setMsg({ kind: 'error', text: `Your name couldn’t be saved${error ? `: ${error.message}` : '.'}` });
    } else {
      await refreshProfile();
      setMsg({ kind: 'ok', text: 'Name saved.' });
    }
    setBusy(false);
  };

  return (
    <Card className="p-6">
      <form onSubmit={save} className="flex flex-col gap-4">
        <h2 className={labelSmall}>Your name</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
            <label htmlFor="full-name" className="text-sm font-semibold">Name</label>
            <input
              id="full-name"
              value={name}
              maxLength={NAME_MAX}
              autoComplete="name"
              onChange={(e) => {
                setName(e.target.value);
                setMsg(null);
              }}
              className={input}
            />
          </div>
          <button type="submit" disabled={!canSave} className={buttonPrimary}>
            {busy ? 'Saving…' : 'Save name'}
          </button>
        </div>
        <span className="text-[13px] text-muted">Shown in the top bar and on the team stats.</span>
        {msg && <Message kind={msg.kind}>{msg.text}</Message>}
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- password

function PasswordCard() {
  const { session } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const email = session?.user.email;
    if (!email) return;
    if (next.length < 8) return setMsg({ kind: 'error', text: 'Use at least 8 characters for the new password.' });
    if (next !== confirm) return setMsg({ kind: 'error', text: 'The two new passwords don’t match.' });
    if (next === current) return setMsg({ kind: 'error', text: 'The new password is the same as the current one.' });

    setBusy(true);
    // check the current password first, so someone at an unlocked computer can't change it
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setMsg({
        kind: 'error',
        text: check.error.message === 'Invalid login credentials' ? 'Your current password isn’t right.' : check.error.message,
      });
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) setMsg({ kind: 'error', text: error.message });
    else {
      setCurrent('');
      setNext('');
      setConfirm('');
      setMsg({ kind: 'ok', text: 'Password updated. Use the new one next time you log in.' });
    }
    setBusy(false);
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <input
        id={id}
        type="password"
        required
        autoComplete={auto}
        value={value}
        onChange={(e) => {
          set(e.target.value);
          setMsg(null);
        }}
        className={input}
      />
    </div>
  );

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className={labelSmall}>Change password</h2>
        {/* hidden username so password managers know which account this is for */}
        <input type="email" autoComplete="username" value={session?.user.email ?? ''} readOnly hidden />
        {field('pw-current', 'Current password', current, setCurrent, 'current-password')}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('pw-new', 'New password', next, setNext, 'new-password')}
          {field('pw-confirm', 'Confirm new password', confirm, setConfirm, 'new-password')}
        </div>
        <span className="text-[13px] text-muted">At least 8 characters.</span>
        {msg && <Message kind={msg.kind}>{msg.text}</Message>}
        <div>
          <button type="submit" disabled={busy} className={buttonPrimary}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- reset data

type Scope = Mode | 'all';
const SCOPES: Array<{ id: Scope; label: string }> = [
  { id: 'all', label: 'All my scores' },
  { id: 'accuracy', label: 'Accuracy only' },
  { id: 'effort', label: 'Effort only' },
];
const CONFIRM_WORD = 'DELETE';

function ResetCard() {
  const { session } = useAuth();
  const { setCurrent } = useCompare();
  const me = session?.user.id ?? '';
  const [counts, setCounts] = useState<Record<Scope, number> | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const loadCounts = useCallback(async () => {
    if (!me) return;
    const { data, error } = await supabase.from('results').select('kind').eq('user_id', me);
    if (error) {
      setMsg({ kind: 'error', text: `Couldn’t count your scores: ${error.message}` });
      return;
    }
    const rows = (data ?? []) as Array<{ kind: Mode }>;
    const accuracy = rows.filter((r) => r.kind === 'accuracy').length;
    const effort = rows.filter((r) => r.kind === 'effort').length;
    setCounts({ all: rows.length, accuracy, effort });
  }, [me]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const n = counts?.[scope] ?? 0;
  const plural = (x: number) => `${x.toLocaleString()} saved score${x === 1 ? '' : 's'}`;
  const canDelete = typed === CONFIRM_WORD && n > 0 && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;
    setBusy(true);
    setMsg(null);
    const { deleted, error } = await deleteMyResults(me, scope);
    if (error) setMsg({ kind: 'error', text: `Nothing was deleted: ${error}` });
    else {
      // an open Results page would otherwise still say "Saved to your stats"
      setCurrent(null);
      setTyped('');
      setScope('all');
      setMsg({ kind: 'ok', text: `Deleted ${plural(deleted)}.` });
      await loadCounts();
    }
    setBusy(false);
  };

  return (
    <Card className="border-del-line p-6">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className={labelSmall}>Reset my data</h2>
          <p className="text-[15px] text-muted">
            Deletes your saved scores from Stats. Your account and name stay. No transcripts are stored, so there are none to delete.
          </p>
        </div>

        {counts === null ? (
          !msg && <p className="text-[15px] text-muted">Counting your scores…</p>
        ) : counts.all === 0 ? (
          <p className="text-[15px] text-muted">You have no saved scores to delete.</p>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">What to delete</legend>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((s) => (
                  <label
                    key={s.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] px-4 text-[15px] ${
                      scope === s.id ? 'border-brand bg-tint-soft font-semibold' : 'border-line bg-white hover:border-field'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={s.id}
                      checked={scope === s.id}
                      onChange={() => {
                        setScope(s.id);
                        setMsg(null);
                      }}
                      className="h-4 w-4 accent-brand"
                    />
                    {s.label} ({counts[s.id].toLocaleString()})
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-1 rounded-xl border border-del-line bg-del-bg px-4 py-3 text-[15px] text-del-fg">
              {n > 0 ? (
                <>
                  <span className="font-bold">This permanently deletes {plural(n)}.</span>
                  <span>Your teammates will no longer see them on the team board. This can’t be undone.</span>
                </>
              ) : (
                <span>You have no {scope === 'accuracy' ? 'Accuracy' : 'Effort'} scores to delete.</span>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
                <label htmlFor="confirm-delete" className="text-sm font-semibold">
                  Type {CONFIRM_WORD} to confirm
                </label>
                <input
                  id="confirm-delete"
                  value={typed}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={n === 0}
                  onChange={(e) => setTyped(e.target.value)}
                  className={`${input} disabled:bg-page`}
                />
              </div>
              <button
                type="submit"
                disabled={!canDelete}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-del-fg px-6 text-[15px] font-bold text-white hover:bg-del-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Deleting…' : n > 0 ? `Delete ${plural(n)}` : 'Delete'}
              </button>
            </div>
          </>
        )}

        {msg && <Message kind={msg.kind}>{msg.text}</Message>}
      </form>
    </Card>
  );
}

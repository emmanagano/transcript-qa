'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Profile } from './supabase';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** true when the user arrived from an invite or password-reset link */
  needsPassword: boolean;
  refreshProfile: () => Promise<void>;
  clearNeedsPassword: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);

  const loadProfile = async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('id, full_name, role').eq('id', userId).single();
    setProfile((data as Profile | null) ?? null);
  };

  useEffect(() => {
    // invite and reset links put "type=invite" / "type=recovery" in the URL hash
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (/type=(invite|recovery)/.test(hash)) setNeedsPassword(true);

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // run outside the callback, as Supabase recommends
        setTimeout(() => loadProfile(s?.user.id), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        profile,
        needsPassword,
        refreshProfile: () => loadProfile(session?.user.id),
        clearNeedsPassword: () => setNeedsPassword(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

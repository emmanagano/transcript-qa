import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Shown in the browser console and the terminal so a missing .env.local is easy to spot
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy env.example.txt to .env.local.');
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // picks up invite and password-reset links
  },
});

export interface Profile {
  id: string;
  full_name: string;
  role: 'senior' | 'junior';
}

export interface ResultRow {
  id: number;
  user_id: string;
  kind: 'accuracy' | 'effort';
  case_name: string;
  ai_tool: string | null;
  score: number;
  ref_words: number;
  total_errors: number;
  total_changes: number;
  counts: Record<string, number>;
  created_at: string;
}

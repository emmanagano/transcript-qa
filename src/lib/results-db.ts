import { supabase, type ResultRow } from './supabase';
import type { OpenComparison } from './compare-store';
import type { Mode } from './compare/engine';

/** Saves only numbers: the score, word count and counts per change type. */
export async function saveResult(c: OpenComparison, userId: string): Promise<{ error: string | null; createdAt: string | null }> {
  const r = c.result;
  const score = c.mode === 'accuracy' ? r.accuracy * 100 : r.changedShare * 100;
  const { data, error } = await supabase
    .from('results')
    .insert({
      user_id: userId,
      kind: c.mode,
      case_name: c.caseName,
      ai_tool: c.mode === 'effort' ? c.aiTool : null,
      score: Math.round(score * 1000) / 1000,
      ref_words: r.refWords,
      total_errors: r.totalErrors,
      total_changes: c.mode === 'effort' ? r.totalChanges : r.totalErrors,
      counts: r.counts,
    })
    .select('created_at')
    .single();
  if (error) return { error: error.message, createdAt: null };
  return { error: null, createdAt: (data as { created_at: string }).created_at };
}

export interface ResultWithName extends ResultRow {
  profiles: { full_name: string } | null;
}

export async function fetchResults(): Promise<{ rows: ResultWithName[]; error: string | null }> {
  const { data, error } = await supabase
    .from('results')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as ResultWithName[], error: null };
}

const NEEDS_SQL = 'Not allowed. Run the latest supabase/schema.sql so you can edit your own results.';

/** Deletes one of your own results. RLS blocks anyone else's. */
export async function deleteResult(id: number): Promise<string | null> {
  const { data, error } = await supabase.from('results').delete().eq('id', id).select('id');
  if (error) return error.message;
  return data && data.length > 0 ? null : NEEDS_SQL;
}

/**
 * Deletes all of your own results, or only one kind. Filters on user_id as well as relying on RLS,
 * so it can never reach anyone else's scores.
 */
export async function deleteMyResults(userId: string, kind: Mode | 'all'): Promise<{ deleted: number; error: string | null }> {
  let q = supabase.from('results').delete().eq('user_id', userId);
  if (kind !== 'all') q = q.eq('kind', kind);
  const { data, error } = await q.select('id');
  if (error) return { deleted: 0, error: error.message };
  return { deleted: data?.length ?? 0, error: null };
}

/** Renames the case on one of your own results (the only editable field). */
export async function renameResult(id: number, caseName: string): Promise<string | null> {
  const { data, error } = await supabase.from('results').update({ case_name: caseName }).eq('id', id).select('id');
  if (error) return error.message;
  return data && data.length > 0 ? null : NEEDS_SQL;
}

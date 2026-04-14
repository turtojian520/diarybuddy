'use server'

import { createClient } from '@/lib/supabase/server'
import type { DiaryFragment, DiaryEntry } from '@/lib/supabase'
import { getTodayDate } from '@/lib/utils'

// ── Fragment Actions ──────────────────────────────────────────────────────────

export async function addFragment(content: string, sessionDate?: string): Promise<DiaryFragment> {
  const supabase = await createClient()
  const date = sessionDate ?? getTodayDate()

  const { data, error } = await supabase
    .from('diary_fragments')
    .insert({ content: content.trim(), session_date: date })
    .select()
    .single()

  if (error) throw new Error(`Failed to save fragment: ${error.message}`)
  return data as DiaryFragment
}

export async function getFragmentsByDate(date: string): Promise<DiaryFragment[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('diary_fragments')
    .select('*')
    .eq('session_date', date)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch fragments: ${error.message}`)
  return (data ?? []) as DiaryFragment[]
}

export async function deleteFragment(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('diary_fragments').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete fragment: ${error.message}`)
}

// ── Diary Entry Actions ───────────────────────────────────────────────────────

export async function getDiaryEntry(date: string): Promise<DiaryEntry | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('session_date', date)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch diary entry: ${error.message}`)
  return data as DiaryEntry | null
}

export async function saveDiaryEntry(entry: Omit<DiaryEntry, 'id' | 'generated_at'>): Promise<DiaryEntry> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('diary_entries')
    .upsert(
      { ...entry, generated_at: new Date().toISOString() },
      { onConflict: 'session_date' }
    )
    .select()
    .single()

  if (error) throw new Error(`Failed to save diary entry: ${error.message}`)
  return data as DiaryEntry
}

export async function getAllDiaryEntries(): Promise<DiaryEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .order('session_date', { ascending: false })

  if (error) throw new Error(`Failed to fetch diary entries: ${error.message}`)
  return (data ?? []) as DiaryEntry[]
}

export async function toggleEntryHighlight(id: string, currentValue: boolean): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('diary_entries')
    .update({ is_highlighted: !currentValue })
    .eq('id', id)
  if (error) throw new Error(`Failed to toggle highlight: ${error.message}`)
}

export async function deleteEntry(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('diary_entries').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete entry: ${error.message}`)
}

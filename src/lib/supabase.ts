import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions matching our database schema
export type DiaryFragment = {
  id: string
  content: string
  created_at: string
  session_date: string  // YYYY-MM-DD, groups fragments by day
}

export type DiaryEntry = {
  id: string
  session_date: string  // YYYY-MM-DD
  title: string
  full_diary: string    // Complete diary narrative (markdown)
  key_points: string    // Key points summary (markdown)
  mentor_insights: string  // Life mentor insights (markdown)
  action_items: string  // Action items checklist (markdown)
  generated_at: string
  is_highlighted: boolean
}

export type DiaryTemplate = {
  id: string
  user_id: string
  name: string
  description: string
  prompt: string        // Custom instructions injected into the AI prompt
  created_at: string
  updated_at: string
}

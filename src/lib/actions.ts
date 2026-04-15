'use server'

import { createClient } from '@/lib/supabase/server'
import type { DiaryFragment, DiaryEntry, DiaryTemplate } from '@/lib/supabase'
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

// ── Template Actions ──────────────────────────────────────────────────────────

export async function getTemplates(): Promise<DiaryTemplate[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('diary_templates')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to fetch templates: ${error.message}`)
  return (data ?? []) as DiaryTemplate[]
}

export async function createTemplate(
  name: string,
  description: string,
  prompt: string,
): Promise<DiaryTemplate> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('diary_templates')
    .insert({ name: name.trim(), description: description.trim(), prompt: prompt.trim() })
    .select()
    .single()
  if (error) throw new Error(`Failed to create template: ${error.message}`)
  return data as DiaryTemplate
}

export async function updateTemplate(
  id: string,
  fields: Partial<Pick<DiaryTemplate, 'name' | 'description' | 'prompt'>>,
): Promise<DiaryTemplate> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('diary_templates')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`Failed to update template: ${error.message}`)
  return data as DiaryTemplate
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('diary_templates').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete template: ${error.message}`)
}

const DEFAULT_TEMPLATES: Array<{ name: string; description: string; prompt: string }> = [
  {
    name: '学术回顾',
    description: '聚焦学习进展、知识整合与研究思考，适合学生或研究者。',
    prompt: `请以学术回顾的风格生成日记，重点关注以下方面：
1. 今日学习的知识点、概念与理论
2. 学术进展、阅读文献或课程内容的理解
3. 思维难点与突破过程
4. 知识整合、跨学科联系与应用思考
5. 下一步学习计划与待攻克的问题

语言风格：条理清晰、逻辑严谨、分析性强。减少情感抒发，增加知识深度与批判性思考。待办事项优先列出学习任务与研究行动。`,
  },
  {
    name: '每日反思',
    description: '关注情绪、人际与内心成长，适合注重自我觉察的日记风格。',
    prompt: `请以个人成长与内心反思的风格生成日记，重点关注以下方面：
1. 今日的情绪状态与内心感受的变化
2. 人际互动、沟通体验与关系观察
3. 个人成长、价值观碰撞与自我认知收获
4. 对生活细节与当下时刻的感悟
5. 心理模式识别与自我接纳的思考

语言风格：真诚、温暖、富有洞察力。注重内心世界的探索而非外部事件罗列。导师建议板块应聚焦心理健康与情感成长。`,
  },
  {
    name: '极简笔记',
    description: '只记核心事件，文字克制简洁，不做过多分析，适合快速记录。',
    prompt: `请以极简风格生成日记，严格遵守以下要求：
1. 完整日记正文控制在 200 字以内，只保留最核心的事件叙述
2. 关键要点最多 3 条，每条一句话
3. 导师洞察板块保持简短，不超过 2-3 句话，省略详细分析
4. 待办事项最多 3 条，只列最重要、最紧迫的任务

语言风格：简洁、克制、直接。不使用修饰性词语，不做延伸联想，只陈述事实与必要行动。`,
  },
]

export async function seedDefaultTemplates(): Promise<DiaryTemplate[]> {
  const supabase = await createClient()

  // Only seed if the user has no templates yet
  const { count } = await supabase
    .from('diary_templates')
    .select('id', { count: 'exact', head: true })

  if ((count ?? 0) > 0) return []

  const { data, error } = await supabase
    .from('diary_templates')
    .insert(DEFAULT_TEMPLATES)
    .select()

  if (error) throw new Error(`Failed to seed templates: ${error.message}`)
  return (data ?? []) as DiaryTemplate[]
}

import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { getFragmentsByDate, saveDiaryEntry } from '@/lib/actions'
import { createClient } from '@/lib/supabase/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Build the prompt for diary generation
function buildPrompt(
  fragments: Array<{ content: string; created_at: string }>,
  date: string,
  templateInstructions?: string,
): string {
  const fragmentsText = fragments
    .map((f, i) => {
      const time = new Date(f.created_at).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      return `[${i + 1}] ${time}: ${f.content}`
    })
    .join('\n\n')

  const styleBlock = templateInstructions
    ? `\n\n【风格指令】\n${templateInstructions}\n`
    : ''

  return `你是一位专业的 AI 日记助手。用户在一天中记录了多条碎片化的想法和笔记。
请根据这些内容，执行以下四项任务：

1. **完整日记（改写重组）**：
   收集用户一天内的全部想法和笔记，根据这些内容写一个完整版的日记。
   要有更好的格式和逻辑结构，更好的写作水平同时不改变日记的原意。
   - 使用 \`# 📝 [日期]完整日记：[主题标题]\` 作为一级标题
   - 按主题分为 3~5 个板块，使用罗马数字编号（I, II, III…），每个板块用 \`###\` 三级标题
   - 将口语化内容重组为流畅的叙述文
   - 保留原意，提升文字质量

2. **关键要点总结**：
   以 \`## ✨ 关键要点总结\` 为标题，列出 5-7 条编号的关键要点，
   每条用一句话概括一个重要事件、决策或感悟。

3. **人生导师洞察与建议**：
   以 \`## 🧠 人生导师的洞察与建议：[洞察标题]\` 为标题，
   作为心理专家/人生导师的角色对用户的一天做出分析。
   包含「重要洞察」（2-3 条深度分析）和「导师建议」（2-3 条可执行建议）。

4. **待办事项列表**：
   以 \`## ✅ 我的待办事项列表\` 为标题，
   用第一人称写一份按领域分类的待办清单。
   使用 \`- [ ]\` 格式，每条配合 **【任务名称】** 加粗标签。

请严格按照上述四个部分的顺序输出，使用 Markdown 格式，专业术语可使用 LaTeX 格式（$\\text{...}$）。
不要添加任何额外的解释性文字。
${styleBlock}
今天是 ${date}。以下是用户今天记录的碎片化想法和笔记：

${fragmentsText}

请严格按照下面的格式分隔符输出，不要在分隔符外添加额外内容：

---FULL_DIARY---
# 📝 ${date} 完整日记：[一句话主题标题]

**主题：[一句话概括当天核心主题]**

### I. [第一个主题板块名称]
[重组后的流畅叙述，保留原意但提升文字质量和逻辑结构]

### II. [第二个主题板块名称]
[重组后的流畅叙述]

### III. [更多板块，按需添加，共 3~5 个]
[重组后的流畅叙述]

---KEY_POINTS---
## ✨ 关键要点总结
1. **[要点一]：** 一句话概括
2. **[要点二]：** 一句话概括
3. **[要点三]：** 一句话概括
（共 5-7 条）

---MENTOR_INSIGHTS---
## 🧠 人生导师的洞察与建议：[洞察标题]

### 重要洞察
- **[洞察一]：** 深度分析
- **[洞察二]：** 心理解读
- **[洞察三]：** 模式识别

### 导师建议：[建议主题]
#### 1. [具体建议一]
- **策略：** …
- **建议：** …

#### 2. [具体建议二]
- **策略：** …
- **建议：** …

---ACTION_ITEMS---
## ✅ 我的待办事项列表

### 📚 [分类一]（优先级：高）
- [ ] **【任务名称】** 任务详细描述

### 🎯 [分类二]
- [ ] **【任务名称】** 任务详细描述

### 🧠 [分类三]
- [ ] **【任务名称】** 任务详细描述
（共 5-8 条，按领域分类，每条有明确行动指令）`
}

// Parse the AI response into four sections
function parseResponse(text: string): {
  title: string
  full_diary: string
  key_points: string
  mentor_insights: string
  action_items: string
} {
  const sections = {
    full_diary: '',
    key_points: '',
    mentor_insights: '',
    action_items: '',
  }

  const fullDiaryMatch = text.match(/---FULL_DIARY---\s*([\s\S]*?)(?=---KEY_POINTS---)/)
  const keyPointsMatch = text.match(/---KEY_POINTS---\s*([\s\S]*?)(?=---MENTOR_INSIGHTS---)/)
  const mentorMatch = text.match(/---MENTOR_INSIGHTS---\s*([\s\S]*?)(?=---ACTION_ITEMS---)/)
  const actionMatch = text.match(/---ACTION_ITEMS---\s*([\s\S]*)/)

  sections.full_diary = fullDiaryMatch?.[1]?.trim() ?? text
  sections.key_points = keyPointsMatch?.[1]?.trim() ?? ''
  sections.mentor_insights = mentorMatch?.[1]?.trim() ?? ''
  sections.action_items = actionMatch?.[1]?.trim() ?? ''

  // Extract the thematic title from "# 📝 date 完整日记：[主题]"
  const themeMatch = sections.full_diary.match(/^#\s+📝[^：:]*[：:]\s*(.+)$/m)
  const title = themeMatch?.[1]?.trim() ?? 'Today\'s Entry'

  return { title, ...sections }
}

export async function POST(request: NextRequest) {
  // Verify the caller is an authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { date } = body as { date: string }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
    }

    // Fetch all fragments for this date
    const fragments = await getFragmentsByDate(date)

    if (fragments.length === 0) {
      return NextResponse.json(
        { error: 'No diary fragments found for this date. Please add some thoughts first.' },
        { status: 400 }
      )
    }

    // Fetch custom template prompt from Supabase (use first template if exists)
    let templateInstructions: string | undefined
    const { data: templates } = await supabase
      .from('diary_templates')
      .select('prompt')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
    if (templates && templates.length > 0 && templates[0].prompt) {
      templateInstructions = templates[0].prompt
    }

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const prompt = buildPrompt(fragments, date, templateInstructions)

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Parse and structure the response
    const parsed = parseResponse(responseText)

    // Save to Supabase
    const entry = await saveDiaryEntry({
      session_date: date,
      title: parsed.title,
      full_diary: parsed.full_diary,
      key_points: parsed.key_points,
      mentor_insights: parsed.mentor_insights,
      action_items: parsed.action_items,
      is_highlighted: false,
    })

    return NextResponse.json({ success: true, entry })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[/api/generate] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { getFragmentsByDate, saveDiaryEntry } from '@/lib/actions'
import { createClient } from '@/lib/supabase/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Build the prompt for diary generation
function buildPrompt(fragments: Array<{ content: string; created_at: string }>, date: string): string {
  const fragmentsText = fragments
    .map((f, i) => {
      const time = new Date(f.created_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
      return `[${i + 1}] ${time}: ${f.content}`
    })
    .join('\n\n')

  return `今天是 ${date}。以下是我今天记录的碎片化想法和笔记：

${fragmentsText}

请根据以上内容，严格按照下面的格式生成四个部分，不要添加任何额外的文字或解释。

---FULL_DIARY---
## 📝 ${date} 完整日记：[一句话主题标题]
**日期：${date}**
**主题：[一句话概括当天核心主题]**

### I. [第一个主题板块名称]
[重组后的流畅叙述，保留原意但提升文字质量和逻辑结构...]

### II. [第二个主题板块名称]
[重组后的流畅叙述...]

### III. [更多板块，按需添加...]
[重组后的流畅叙述...]

---KEY_POINTS---
## ✨ 关键要点总结
1. **[要点一]：** 一句话概括...
2. **[要点二]：** 一句话概括...
3. **[要点三]：** 一句话概括...
（共5-7条）

---MENTOR_INSIGHTS---
## 🧠 人生导师的洞察与建议：[洞察标题]

### 重要洞察
- **[洞察一]：** 深度分析...
- **[洞察二]：** 心理解读...
- **[洞察三]：** 模式识别...

### 导师建议：[建议主题]
#### 1. [具体建议一]
- **策略：** ...
- **建议：** ...

#### 2. [具体建议二]
- **策略：** ...
- **建议：** ...

---ACTION_ITEMS---
## ✅ 我的待办事项列表

### 📚 [分类一]（优先级：高）
- [ ] **【任务名称】** 任务详细描述...
- [ ] **【任务名称】** 任务详细描述...

### 🎯 [分类二]
- [ ] **【任务名称】** 任务详细描述...

### 🧠 [分类三]
- [ ] **【任务名称】** 任务详细描述...
（共5-8条，按领域分类，每条有明确行动指令）`
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

  const fullDiaryMatch = text.match(/---FULL_DIARY---\s*([\s\S]*?)(?=---KEY_POINTS---|$)/)
  const keyPointsMatch = text.match(/---KEY_POINTS---\s*([\s\S]*?)(?=---MENTOR_INSIGHTS---|$)/)
  const mentorMatch = text.match(/---MENTOR_INSIGHTS---\s*([\s\S]*?)(?=---ACTION_ITEMS---|$)/)
  const actionMatch = text.match(/---ACTION_ITEMS---\s*([\s\S]*?)$/)

  sections.full_diary = fullDiaryMatch?.[1]?.trim() ?? text
  sections.key_points = keyPointsMatch?.[1]?.trim() ?? ''
  sections.mentor_insights = mentorMatch?.[1]?.trim() ?? ''
  sections.action_items = actionMatch?.[1]?.trim() ?? ''

  // Extract title from first heading in full_diary, or generate one
  const headingMatch = sections.full_diary.match(/^#\s+(.+)$/m)
  const title = headingMatch?.[1]?.trim() ?? 'Today\'s Entry'

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

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const prompt = buildPrompt(fragments, date)

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

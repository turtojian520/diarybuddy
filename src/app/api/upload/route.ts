import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTodayDate } from '@/lib/utils'

const BUCKET = 'attachments'
const MAX_SUMMARY_BYTES = 18 * 1024 * 1024 // Gemini inline data soft cap

function isAllowedMime(mime: string): boolean {
  return (
    mime.startsWith('image/') ||
    mime === 'application/pdf' ||
    mime.startsWith('audio/') ||
    mime.startsWith('text/') ||
    mime === 'application/json'
  )
}

function summaryPromptFor(mime: string): string {
  if (mime.startsWith('image/')) {
    return '请用一段简短中文（约 60-100 字）描述这张图片的核心内容、主要元素和氛围，便于用户后续在日记里回忆这张图。请直接给出描述，不要寒暄。'
  }
  if (mime === 'application/pdf') {
    return '请用一段简短中文（约 80-150 字）总结这份 PDF 文档的核心内容、主要论点或关键数据，便于用户后续回顾。请直接给出总结，不要寒暄。'
  }
  if (mime.startsWith('audio/')) {
    return '请用一段简短中文（约 80-150 字）总结这段音频的核心内容、主题或情绪，便于用户后续回顾。如果能识别出具体内容请概括，否则描述音频特征。请直接给出总结，不要寒暄。'
  }
  if (mime.startsWith('text/') || mime === 'application/json') {
    return '请用一段简短中文（约 80-150 字）总结这份文本的核心内容或要点，便于用户后续回顾。请直接给出总结，不要寒暄。'
  }
  return '请用一段简短中文（约 80-150 字）总结这份内容。请直接给出总结，不要寒暄。'
}

type Body = {
  storage_path: string
  attachment_url: string
  attachment_name: string
  attachment_type: string
  session_date?: string
  content?: string
  file_size?: number
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { storage_path, attachment_url, attachment_name, attachment_type } = body
  if (!storage_path || !attachment_url || !attachment_name || !attachment_type) {
    return NextResponse.json({ error: '缺少必要字段。' }, { status: 400 })
  }
  if (!isAllowedMime(attachment_type)) {
    return NextResponse.json(
      { error: `不支持的文件类型：${attachment_type}。仅接受图片 / PDF / 音频 / 文本。` },
      { status: 415 },
    )
  }
  // Enforce the path namespace so a client can't claim someone else's file.
  if (!storage_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: '路径不属于当前用户。' }, { status: 403 })
  }

  const sessionDate =
    body.session_date && /^\d{4}-\d{2}-\d{2}$/.test(body.session_date)
      ? body.session_date
      : getTodayDate()
  const caption = body.content?.trim() ?? ''

  // Generate Gemini summary — pull the file back from Storage server-side.
  // Skip for files too large for inline_data; record a placeholder instead.
  let summary = ''
  try {
    if ((body.file_size ?? 0) > MAX_SUMMARY_BYTES) {
      summary = '（文件较大，未生成 AI 简介）'
    } else {
      if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured')

      const { data: blob, error: dlError } = await supabase.storage
        .from(BUCKET)
        .download(storage_path)
      if (dlError || !blob) throw new Error(dlError?.message ?? '无法读取上传的文件')

      const bytes = new Uint8Array(await blob.arrayBuffer())
      const base64 = Buffer.from(bytes).toString('base64')

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const result = await model.generateContent([
        { inlineData: { data: base64, mimeType: attachment_type } },
        { text: summaryPromptFor(attachment_type) },
      ])
      summary = result.response.text().trim()
    }
  } catch (err) {
    summary = `（AI 简介生成失败：${err instanceof Error ? err.message : '未知错误'}）`
  }

  const { data: inserted, error: insertError } = await supabase
    .from('diary_fragments')
    .insert({
      content: caption,
      session_date: sessionDate,
      attachment_url,
      attachment_name,
      attachment_type,
      attachment_summary: summary,
    })
    .select()
    .single()

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storage_path])
    return NextResponse.json(
      { error: `保存碎片失败：${insertError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, fragment: inserted })
}

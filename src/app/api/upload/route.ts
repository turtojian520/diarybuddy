import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTodayDate } from '@/lib/utils'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const BUCKET = 'attachments'

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

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const sessionDateRaw = formData.get('session_date')
  const caption = (formData.get('content') as string | null)?.trim() ?? ''

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少文件。' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: '文件为空。' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: '文件超过 10MB 上限。' }, { status: 413 })
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json(
      { error: `不支持的文件类型：${file.type || '未知'}。仅接受图片 / PDF / 音频 / 文本。` },
      { status: 415 },
    )
  }

  const sessionDate =
    typeof sessionDateRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sessionDateRaw)
      ? sessionDateRaw
      : getTodayDate()

  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'file'
  const path = `${user.id}/${Date.now()}_${safeName}`

  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `上传失败：${uploadError.message}` },
      { status: 500 },
    )
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = publicUrlData.publicUrl

  let summary = ''
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const base64 = Buffer.from(bytes).toString('base64')
    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType: file.type } },
      { text: summaryPromptFor(file.type) },
    ])
    summary = result.response.text().trim()
  } catch (err) {
    summary = `（AI 简介生成失败：${err instanceof Error ? err.message : '未知错误'}）`
  }

  const { data: inserted, error: insertError } = await supabase
    .from('diary_fragments')
    .insert({
      content: caption,
      session_date: sessionDate,
      attachment_url: publicUrl,
      attachment_name: file.name,
      attachment_type: file.type,
      attachment_summary: summary,
    })
    .select()
    .single()

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json(
      { error: `保存碎片失败：${insertError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, fragment: inserted })
}

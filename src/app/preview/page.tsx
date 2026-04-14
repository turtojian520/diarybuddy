'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bookmark, Copy, Download, CheckSquare, Square, Library, Loader2 } from 'lucide-react'
import { getDiaryEntry } from '@/lib/actions'
import { getTodayDate } from '@/lib/utils'
import type { DiaryEntry } from '@/lib/supabase'

function parseActionItems(markdown: string): Array<{ text: string; checked: boolean }> {
  if (!markdown) return []
  return markdown
    .split('\n')
    .filter((line) => line.trim().match(/^- \[[ x]\]/i))
    .map((line) => {
      const checked = /^- \[x\]/i.test(line.trim())
      const text = line.replace(/^- \[[ x]\]\s*/i, '').trim()
      return { text, checked }
    })
}

function MarkdownBlock({ content }: { content: string }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="mb-8 text-2xl font-normal italic text-[#2B2A27]">
          {line.replace('## ', '')}
        </h2>
      )
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="mb-8 text-3xl font-normal leading-snug tracking-tight text-[#2B2A27] sm:text-4xl">
          {line.replace('# ', '')}
        </h1>
      )
    } else if (line.startsWith('> ') || line.startsWith('>')) {
      elements.push(
        <blockquote key={i} className="my-6 border-l-4 border-[#D4A373] bg-[#F6F3EE]/50 py-2 pl-6 sm:pl-8">
          <p className="text-base italic leading-relaxed text-[#4A4A4A] sm:text-lg">
            {line.replace(/^>\s*/, '')}
          </p>
        </blockquote>
      )
    } else if (line.match(/^\d+\.\s/)) {
      const listItems: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={`list-${i}`} className="ml-6 list-decimal space-y-4 text-base leading-relaxed text-[#4A4A4A] sm:text-lg">
          {listItems.map((item, j) => (
            <li key={j} className="pl-4" dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
          ))}
        </ol>
      )
      continue
    } else if (line.startsWith('- ') && !line.match(/^- \[/)) {
      const listItems: string[] = []
      while (i < lines.length && lines[i].startsWith('- ') && !lines[i].match(/^- \[/)) {
        listItems.push(lines[i].replace(/^- /, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="ml-6 list-disc space-y-3 text-base leading-relaxed text-[#4A4A4A] sm:text-lg">
          {listItems.map((item, j) => (
            <li key={j} className="pl-2" dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
          ))}
        </ul>
      )
      continue
    } else if (line.trim() === '' || line === '---') {
      if (line === '---') {
        elements.push(<hr key={i} className="border-dashed border-[#EAE1D3]" />)
      }
    } else if (line.trim()) {
      elements.push(
        <p
          key={i}
          className="text-base leading-loose tracking-wide text-[#4A4A4A] sm:text-lg sm:indent-8"
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
        />
      )
    }
    i++
  }

  return <div className="space-y-6">{elements}</div>
}

export default function PreviewPage() {
  const [entry, setEntry] = useState<DiaryEntry | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [taskStates, setTaskStates] = useState<boolean[]>([])
  const [copySuccess, setCopySuccess] = useState(false)
  const [viewDate, setViewDate] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const dateParam = params.get('date')
    const date = dateParam ?? getTodayDate()
    setViewDate(date)
    loadEntry(date)
  }, [])

  const loadEntry = useCallback(async (date: string) => {
    setIsLoading(true)
    try {
      const data = await getDiaryEntry(date)
      setEntry(data)
      if (data) {
        const items = parseActionItems(data.action_items)
        setTaskStates(items.map((item) => item.checked))
      }
    } catch (err) {
      console.error('Failed to load entry:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  function toggleTask(index: number) {
    setTaskStates((prev) => prev.map((v, i) => (i === index ? !v : v)))
  }

  async function handleCopy() {
    if (!entry) return
    const fullText = [entry.full_diary, entry.key_points, entry.mentor_insights, entry.action_items]
      .filter(Boolean)
      .join('\n\n---\n\n')
    await navigator.clipboard.writeText(fullText)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  function handleDownload() {
    if (!entry) return
    const fullText = [entry.full_diary, entry.key_points, entry.mentor_insights, entry.action_items]
      .filter(Boolean)
      .join('\n\n---\n\n')
    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `diarybuddy-${viewDate}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4A373]" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#FDFBF7] px-4 pb-20 pt-24 text-[#333333] sm:px-6 lg:pb-32">
      <div className="w-full max-w-3xl">
        {/* 顶部操作栏 */}
        <header className="mb-12 flex flex-col gap-6 sm:mb-16 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-[#8C7B6A] transition-colors hover:text-[#4A4A4A]">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Bookmark className="h-4 w-4 text-[#D4A373]" />
            <span className="text-sm uppercase tracking-[0.2em] text-[#9f8a76]">已生成的日记</span>
          </div>

          {entry && (
            <div className="flex flex-wrap gap-3">
              <Link
                href="/history"
                className="flex items-center space-x-2 rounded-full border border-[#EAE1D3] px-3 py-1.5 text-sm text-[#6B5C4C] transition-all hover:border-[#D4A373]/50 hover:text-[#D4A373]"
              >
                <Library className="h-4 w-4" />
                <span>历史</span>
              </Link>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center space-x-2 rounded-full border border-transparent px-3 py-1.5 text-sm text-[#6B5C4C] transition-all hover:border-[#D4A373]/30 hover:text-[#D4A373]"
              >
                <Copy className="h-4 w-4" />
                <span>{copySuccess ? '已复制！' : '复制文字'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center space-x-2 rounded-full border border-transparent px-3 py-1.5 text-sm text-[#6B5C4C] transition-all hover:border-[#D4A373]/30 hover:text-[#D4A373]"
              >
                <Download className="h-4 w-4" />
                <span>保存 .md</span>
              </button>
            </div>
          )}
        </header>

        {/* 无内容状态 */}
        {!entry && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-xl italic text-[#B4AC9F]">未找到该日期的日记。</p>
            <p className="mt-3 text-sm text-[#C4B9AA]">前往工作台，添加想法，然后点击生成。</p>
            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#D4A373] px-6 py-3 text-sm text-white transition-colors hover:bg-[#C39363]"
            >
              前往工作台
            </Link>
          </div>
        )}

        {/* 日记内容 */}
        {entry && (
          <article className="space-y-16 sm:space-y-24">
            <section>
              <MarkdownBlock content={entry.full_diary} />
            </section>

            {entry.key_points && (
              <>
                <hr className="border-dashed border-[#EAE1D3]" />
                <section>
                  <h2 className="mb-8 text-2xl font-normal italic text-[#2B2A27]">关键要点</h2>
                  <MarkdownBlock content={entry.key_points} />
                </section>
              </>
            )}

            {entry.mentor_insights && (
              <>
                <hr className="border-dashed border-[#EAE1D3]" />
                <section>
                  <h2 className="mb-8 text-2xl font-normal italic text-[#2B2A27]">静思洞察</h2>
                  <blockquote className="my-6 border-l-4 border-[#D4A373] bg-[#F6F3EE]/50 py-4 pl-6 sm:pl-8">
                    <p className="text-base leading-relaxed text-[#4A4A4A] sm:text-lg whitespace-pre-line">
                      {entry.mentor_insights}
                    </p>
                  </blockquote>
                </section>
              </>
            )}

            {entry.action_items && parseActionItems(entry.action_items).length > 0 && (
              <>
                <hr className="border-dashed border-[#EAE1D3]" />
                <section>
                  <h2 className="mb-8 text-2xl font-normal italic text-[#2B2A27]">明日行动清单</h2>
                  <div className="space-y-5 text-base text-[#4A4A4A] sm:text-lg">
                    {parseActionItems(entry.action_items).map((task, index) => {
                      const isDone = taskStates[index] ?? task.checked
                      return (
                        <button
                          key={task.text}
                          type="button"
                          onClick={() => toggleTask(index)}
                          className="group flex items-start text-left"
                        >
                          {isDone ? (
                            <CheckSquare className="mr-4 mt-1.5 h-5 w-5 shrink-0 text-[#D4A373]" />
                          ) : (
                            <Square className="mr-4 mt-1.5 h-5 w-5 shrink-0 text-[#8C7B6A] transition-colors group-hover:text-[#D4A373]" />
                          )}
                          <span className={`leading-relaxed ${isDone ? 'line-through text-[#8C7B6A]' : ''}`}>
                            {task.text}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              </>
            )}
          </article>
        )}
      </div>
    </div>
  )
}

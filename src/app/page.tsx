'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Mic, Paperclip, Sparkles, BookText, ArrowRight, Settings, Trash2, Loader2 } from 'lucide-react'
import { addFragment, getFragmentsByDate, deleteFragment } from '@/lib/actions'
import { getTodayDate } from '@/lib/utils'
import type { DiaryFragment } from '@/lib/supabase'

export default function WorkspacePage() {
  const [fragments, setFragments] = useState<DiaryFragment[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [todayDate, setTodayDate] = useState('')
  const [displayDate, setDisplayDate] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const date = getTodayDate()
    setTodayDate(date)

    const [year, month, day] = date.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    setDisplayDate(d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }))

    loadFragments(date)
  }, [])

  async function loadFragments(date: string) {
    try {
      const data = await getFragmentsByDate(date)
      setFragments(data)
    } catch (err) {
      console.error('Failed to load fragments:', err)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const newFragment = await addFragment(text, todayDate)
      setFragments((prev) => [...prev, newFragment])
      setInputValue('')
      inputRef.current?.focus()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败，请重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteFragment(id)
      setFragments((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '删除失败。')
    }
  }

  async function handleGenerate() {
    if (fragments.length === 0) {
      setErrorMsg('请先添加一些想法再生成日记。')
      return
    }
    if (isGenerating) return

    setIsGenerating(true)
    setErrorMsg('')
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayDate }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? '生成失败')

      window.location.href = '/preview'
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '日记生成失败，请检查 API 密钥。')
      setIsGenerating(false)
    }
  }

  function formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FDFBF7] pt-20 text-[#333333] lg:h-screen lg:flex-row">
      {/* 侧边栏 */}
      <aside className="flex w-full flex-col justify-between border-b border-[#EAE1D3] bg-[#F6F3EE] lg:w-72 lg:border-b-0 lg:border-r">
        <div>
          <div className="px-6 pb-4 pt-8 sm:px-8">
            <h1 className="text-3xl font-bold italic tracking-tight text-[#4A4A4A]">日记伙伴</h1>
            <p className="mt-2 text-sm text-[#8C7B6A]">记录碎片，整理成一篇完整的日记。</p>
          </div>

          <div className="px-6 py-4">
            <div className="rounded border border-[#EAE1D3] bg-[#FDFBF7] p-4 shadow-sm shadow-[#EAE1D3]/50">
              <h3 className="mb-2 text-xs uppercase tracking-widest text-[#8C7B6A]">今日进度</h3>
              <p className="text-2xl font-light text-[#4A4A4A]">{fragments.length}</p>
              <p className="text-xs text-[#8C7B6A]">条想法已记录</p>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest text-[#8C7B6A]">最近记录</h3>
              <Link
                href="/history"
                className="text-xs uppercase tracking-widest text-[#8C7B6A] transition-colors hover:text-[#D4A373]"
              >
                查看历史
              </Link>
            </div>
            <p className="text-xs italic text-[#B4AC9F]">
              {fragments.length > 0
                ? `今天已添加 ${fragments.length} 条记录。`
                : '在下方输入，记录今天的第一个想法。'}
            </p>
          </div>
        </div>

        <div className="p-6">
          <Link
            href="/settings"
            className="group flex w-full items-center space-x-3 text-[#6B5C4C] transition-colors hover:text-[#333333]"
          >
            <Settings className="h-5 w-5 transition-transform duration-300 group-hover:rotate-45" />
            <span className="text-sm tracking-wide">偏好设置</span>
          </Link>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="relative flex min-h-[calc(100vh-5rem)] flex-1 flex-col px-6 sm:px-10 lg:min-h-screen lg:px-20">
        <header className="flex flex-col gap-6 border-b border-[#EAE1D3] py-10 sm:py-12 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="mb-2 text-3xl font-normal text-[#2B2A27] sm:text-4xl">{displayDate}</h2>
            <p className="text-sm italic text-[#8C7B6A]">静静地记录你的想法……</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/history"
              className="rounded-full border border-[#EAE1D3] px-4 py-2 text-sm text-[#6B5C4C] transition-colors hover:border-[#D4A373] hover:text-[#2B2A27]"
            >
              浏览归档
            </Link>
            <Link
              href="/preview"
              className="inline-flex items-center gap-2 rounded-full bg-[#2B2A27] px-4 py-2 text-sm text-white transition-colors hover:bg-[#45423d]"
            >
              <BookText className="h-4 w-4" />
              打开已生成日记
            </Link>
          </div>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto py-8 pb-36 sm:space-y-12 sm:py-10">
          {fragments.length > 0 && (
            <div className="flex flex-col gap-3 rounded-[28px] border border-[#efe2d0] bg-[#fbf6ee] p-5 shadow-[0_12px_30px_rgba(212,163,115,0.08)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[#A48C72]">今日记录</p>
                <p className="mt-2 text-base leading-relaxed text-[#5D5045]">
                  已收集 {fragments.length} 条想法，可以生成日记了。
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 text-sm font-medium text-[#8C5F34] transition-colors hover:text-[#6f4924] disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {isGenerating ? '生成中……' : '生成日记'}
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {fragments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg italic text-[#B4AC9F]">页面还是空白的。</p>
              <p className="mt-2 text-sm text-[#C4B9AA]">在下方输入，记录今天的第一个想法。</p>
            </div>
          )}

          {fragments.map((fragment) => (
            <div key={fragment.id} className="group relative flex gap-4 sm:gap-8">
              <div className="w-20 shrink-0 pt-1 text-right sm:w-24">
                <span className="text-xs uppercase tracking-wider text-[#8C7B6A]">
                  {formatTime(fragment.created_at)}
                </span>
              </div>
              <div className="flex-1 max-w-2xl text-base leading-loose text-[#4A4A4A] sm:text-lg">
                {fragment.content}
              </div>
              <div className="absolute right-0 top-0 flex space-x-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => handleDelete(fragment.id)}
                  className="text-xs text-[#8C7B6A] hover:text-red-500 transition-colors"
                  title="删除此碎片"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 底部固定输入栏 */}
        <div className="sticky bottom-0 left-0 right-0 mt-auto bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7] to-transparent pb-8 pt-6 sm:pb-12 sm:pt-8">
          <form
            onSubmit={handleSubmit}
            className="flex max-w-4xl flex-col gap-3 rounded-3xl border border-[#EAE1D3] bg-white px-4 py-4 shadow-sm shadow-[#EAE1D3]/30 sm:flex-row sm:items-center sm:space-x-4 sm:gap-0"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full p-2 text-[#8C7B6A] transition-colors hover:bg-[#F6F3EE] hover:text-[#D4A373]"
                title="语音输入（即将上线）"
              >
                <Mic className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="rounded-full p-2 text-[#8C7B6A] transition-colors hover:bg-[#F6F3EE] hover:text-[#D4A373]"
                title="附件（即将上线）"
              >
                <Paperclip className="h-5 w-5" />
              </button>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="今天有什么想法？"
              className="min-w-0 flex-1 bg-transparent text-base text-[#4A4A4A] outline-none placeholder:italic placeholder:text-[#B4AC9F] sm:text-lg"
              disabled={isSubmitting}
            />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !inputValue.trim()}
                className="flex items-center justify-center space-x-2 rounded-full border border-[#EAE1D3] px-4 py-2.5 text-sm text-[#6B5C4C] transition-colors hover:border-[#D4A373] hover:text-[#D4A373] disabled:opacity-40"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>保存</span>}
              </button>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || fragments.length === 0}
                className="flex items-center justify-center space-x-2 rounded-full bg-[#D4A373] px-5 py-2.5 text-white shadow-sm shadow-[#D4A373]/20 transition-colors hover:bg-[#C39363] disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="text-sm font-medium tracking-wide">
                  {isGenerating ? '生成中……' : '生成'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

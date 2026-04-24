'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Mic, Paperclip, Sparkles, BookText, ArrowRight, Settings, Trash2, Loader2, ChevronDown, CloudOff } from 'lucide-react'
import { addFragment, getFragmentsByDate, deleteFragment } from '@/lib/actions'
import { getTodayDate } from '@/lib/utils'
import type { DiaryFragment } from '@/lib/supabase'
import { BottomSheet } from '@/components/BottomSheet'
import { GenerateBanner } from '@/components/GenerateBanner'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { MobileQuickInputBar } from '@/components/MobileQuickInputBar'
import { InstallPrompt } from '@/components/InstallPrompt'
import {
  enqueue as enqueueOffline,
  generateLocalId,
  listPending,
  removePending,
  type PendingFragment,
} from '@/lib/offlineQueue'

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspaceContent />
    </Suspense>
  )
}

function WorkspaceContent() {
  const [fragments, setFragments] = useState<DiaryFragment[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [todayDate, setTodayDate] = useState('')
  const [displayDate, setDisplayDate] = useState('')
  const [diaryGenerated, setDiaryGenerated] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileSheetInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newDate = e.target.value
    if (!newDate || newDate === todayDate) return
    sessionStorage.setItem('workspaceSessionDate', newDate)
    window.location.href = `/?date=${newDate}`
  }

  function openDatePicker() {
    const input = dateInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    } else {
      input.click()
    }
  }

  useEffect(() => {
    // If a ?date= param is provided (e.g. to restore yesterday's view), use it.
    // Otherwise, read the session date stored at session start so midnight doesn't
    // silently flip the workspace to a new day while the user is still writing.
    const paramDate = searchParams.get('date')
    let sessionDate: string

    if (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) {
      // Explicit date requested via URL – use it and persist it as the session date.
      sessionDate = paramDate
      sessionStorage.setItem('workspaceSessionDate', sessionDate)
    } else {
      // No URL param: use the stored session date if it exists, otherwise seed it
      // with today's real date and save it so midnight won't change it.
      const stored = sessionStorage.getItem('workspaceSessionDate')
      sessionDate = stored ?? getTodayDate()
      if (!stored) {
        sessionStorage.setItem('workspaceSessionDate', sessionDate)
      }
    }

    setTodayDate(sessionDate)

    const [year, month, day] = sessionDate.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    setDisplayDate(d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }))

    loadFragments(sessionDate)
  }, [searchParams])

  // Drain the offline queue for the current day whenever we come back online.
  // drainQueueFor/loadFragments close over stable module-level server actions + setState,
  // so only todayDate is a real dependency here.
  useEffect(() => {
    if (!todayDate) return
    const onOnline = () => { void drainQueueFor(todayDate) }
    window.addEventListener('online', onOnline)
    if (navigator.onLine) void drainQueueFor(todayDate)
    return () => window.removeEventListener('online', onOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDate])

  async function loadFragments(date: string) {
    try {
      const data = await getFragmentsByDate(date)
      const pending = (await listPending()).filter((p) => p.session_date === date)
      const combined: DiaryFragment[] = [
        ...data,
        ...pending.map((p) => ({
          id: p.localId,
          content: p.content,
          created_at: p.created_at,
          session_date: p.session_date,
        } as unknown as DiaryFragment)),
      ]
      setFragments(combined)
    } catch (err) {
      console.error('Failed to load fragments:', err)
    }
  }

  async function drainQueueFor(date: string) {
    const pending = (await listPending()).filter((p) => p.session_date === date)
    if (pending.length === 0) return
    let anySynced = false
    for (const p of pending) {
      try {
        await addFragment(p.content, p.session_date)
        await removePending(p.localId)
        anySynced = true
      } catch {
        // Still offline or server rejecting; stop early, try again next online event.
        break
      }
    }
    if (anySynced) {
      await loadFragments(date)
    }
  }

  async function submitFragment(text: string): Promise<void> {
    // Try online first; if that fails (typically offline), enqueue locally.
    try {
      const newFragment = await addFragment(text, todayDate)
      setFragments((prev) => [...prev, newFragment])
      return
    } catch (err) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      if (!offline) {
        // Real server error — surface it and don't queue (would just re-fail).
        throw err
      }
      const pending: PendingFragment = {
        localId: generateLocalId(),
        content: text,
        session_date: todayDate,
        created_at: new Date().toISOString(),
      }
      await enqueueOffline(pending)
      setFragments((prev) => [
        ...prev,
        {
          id: pending.localId,
          content: pending.content,
          created_at: pending.created_at,
          session_date: pending.session_date,
        } as unknown as DiaryFragment,
      ])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg('')
    try {
      await submitFragment(text)
      setInputValue('')
      inputRef.current?.focus()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败，请重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (id.startsWith('local-')) {
      await removePending(id)
      setFragments((prev) => prev.filter((f) => f.id !== id))
      return
    }
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

      // Diary saved successfully: advance the workspace session to today's real date
      // so the next time the user opens the workspace they start fresh on today.
      const realToday = getTodayDate()
      sessionStorage.setItem('workspaceSessionDate', realToday)
      setDiaryGenerated(true)

      // Pass the date so preview loads the correct entry (not always "today")
      window.location.href = `/preview?date=${todayDate}`
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

  async function handleMobileSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg('')
    try {
      await submitFragment(text)
      setInputValue('')
      setMobileSheetOpen(false)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败，请重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--db-bg)] pt-6 text-[var(--db-ink)] md:pt-20 lg:h-screen lg:flex-row">
      {/* 侧边栏 — 桌面 / 平板显示，手机隐藏 */}
      <aside className="hidden w-full flex-col justify-between border-b border-[var(--db-border)] bg-[var(--db-surface)] md:flex lg:w-72 lg:border-b-0 lg:border-r">
        <div>
          <div className="px-6 pb-4 pt-8 sm:px-8">
            <h1 className="text-3xl font-bold italic tracking-tight text-[var(--db-ink-2)]">Diarybuddy</h1>
            <p className="mt-2 text-sm text-[var(--db-muted)]">记录碎片，整理成一篇完整的日记。</p>
          </div>

          <div className="px-6 py-4">
            <div className="rounded border border-[var(--db-border)] bg-[var(--db-bg)] p-4 shadow-sm shadow-[var(--db-border)]/50">
              <h3 className="mb-2 text-xs uppercase tracking-widest text-[var(--db-muted)]">今日进度</h3>
              <p className="text-2xl font-light text-[var(--db-ink-2)]">{fragments.length}</p>
              <p className="text-xs text-[var(--db-muted)]">条想法已记录</p>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest text-[var(--db-muted)]">最近记录</h3>
            </div>
            <p className="text-xs italic text-[var(--db-faint)]">
              {fragments.length > 0
                ? `今天已添加 ${fragments.length} 条记录。`
                : '在下方输入，记录今天的第一个想法。'}
            </p>
          </div>
        </div>

        <div className="p-6">
          <Link
            href="/settings"
            className="group flex w-full items-center space-x-3 text-[var(--db-ink-2)] transition-colors hover:text-[var(--db-ink)]"
          >
            <Settings className="h-5 w-5 transition-transform duration-300 group-hover:rotate-45" />
            <span className="text-sm tracking-wide">偏好设置</span>
          </Link>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="relative flex min-h-[calc(100vh-5rem)] flex-1 flex-col px-6 sm:px-10 lg:min-h-screen lg:px-20">
        <header className="flex flex-col gap-6 border-b border-[var(--db-border)] py-10 sm:py-12 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-3xl font-normal text-[var(--db-ink)] sm:text-4xl">{displayDate}</h2>
              <div className="relative inline-flex">
                <button
                  type="button"
                  onClick={openDatePicker}
                  className="rounded-full p-1.5 text-[var(--db-muted)] transition-colors hover:bg-[var(--db-surface)] hover:text-[var(--db-accent)]"
                  title="选择其他日期"
                  aria-label="选择其他日期"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={todayDate}
                  max={getTodayDate()}
                  onChange={handleDateChange}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="选择日期"
                  tabIndex={-1}
                />
              </div>
            </div>
            <p className="text-sm italic text-[var(--db-muted)]">
              {todayDate !== getTodayDate()
                ? `正在查看 ${displayDate} 的工作台 · `
                : ''}
              静静地记录你的想法……
            </p>
          </div>

          <div className="hidden flex-wrap gap-3 md:flex">
            <Link
              href="/history"
              className="rounded-full border border-[var(--db-border)] px-4 py-2 text-sm text-[var(--db-ink-2)] transition-colors hover:border-[var(--db-accent)] hover:text-[var(--db-ink)]"
            >
              浏览归档
            </Link>
            <Link
              href={`/preview?date=${todayDate || getTodayDate()}`}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--db-ink)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--db-ink)]"
            >
              <BookText className="h-4 w-4" />
              打开已生成日记
            </Link>
          </div>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto py-8 pb-44 sm:space-y-12 sm:py-10 md:pb-36">
          {/* 移动端：顶部 GenerateBanner（次动作入口，永远可见） */}
          <div className="md:hidden">
            <GenerateBanner
              count={fragments.length}
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
            />
          </div>

          {/* 桌面/平板：原有的 "今日记录" 横条（视觉零改动） */}
          {fragments.length > 0 && (
            <div className="hidden flex-col gap-3 rounded-[28px] border border-[var(--db-border-soft)] bg-[var(--db-surface-2)] p-5 shadow-[0_12px_30px_rgba(212,163,115,0.08)] sm:flex-row sm:items-center sm:justify-between md:flex">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--db-muted)]">今日记录</p>
                <p className="mt-2 text-base leading-relaxed text-[var(--db-ink-2)]">
                  已收集 {fragments.length} 条想法，可以生成日记了。
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--db-accent-deep)] transition-colors hover:text-[var(--db-accent-deep)] disabled:opacity-50"
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
              <p className="text-lg italic text-[var(--db-faint)]">页面还是空白的。</p>
              <p className="mt-2 text-sm text-[var(--db-faint)]">在下方输入，记录今天的第一个想法。</p>
            </div>
          )}

          {fragments.map((fragment) => {
            const isPending = fragment.id.startsWith('local-')
            return (
            <div key={fragment.id} className="group relative flex gap-4 sm:gap-8">
              <div className="w-20 shrink-0 pt-1 text-right sm:w-24">
                <span className="text-xs uppercase tracking-wider text-[var(--db-muted)]">
                  {formatTime(fragment.created_at)}
                </span>
              </div>
              <div className={`flex-1 max-w-2xl text-base leading-loose sm:text-lg ${isPending ? 'text-[var(--db-muted)]' : 'text-[var(--db-ink-2)]'}`}>
                {fragment.content}
                {isPending && (
                  <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs text-[var(--db-faint)]" title="离线中，恢复网络后自动同步">
                    <CloudOff className="h-3 w-3" aria-hidden />
                    待同步
                  </span>
                )}
              </div>
              <div className="absolute right-0 top-0 flex space-x-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => handleDelete(fragment.id)}
                  className="text-xs text-[var(--db-muted)] hover:text-red-500 transition-colors"
                  title={isPending ? '移除这条待同步碎片' : '删除此碎片'}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            )
          })}
        </div>

        {/* 底部固定输入栏 — 桌面/平板使用，手机改用 QuickInputBar + BottomSheet */}
        <div className="sticky bottom-0 left-0 right-0 mt-auto hidden bg-gradient-to-t from-[var(--db-bg)] via-[var(--db-bg)] to-transparent pb-8 pt-6 sm:pb-12 sm:pt-8 md:block">
          <form
            onSubmit={handleSubmit}
            className="flex max-w-4xl flex-col gap-3 rounded-3xl border border-[var(--db-border)] bg-[var(--db-card)] px-4 py-4 shadow-sm shadow-[var(--db-border)]/30 sm:flex-row sm:items-center sm:space-x-4 sm:gap-0"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full p-2 text-[var(--db-muted)] transition-colors hover:bg-[var(--db-surface)] hover:text-[var(--db-accent)]"
                title="语音输入（即将上线）"
              >
                <Mic className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="rounded-full p-2 text-[var(--db-muted)] transition-colors hover:bg-[var(--db-surface)] hover:text-[var(--db-accent)]"
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
              className="min-w-0 flex-1 bg-transparent text-base text-[var(--db-ink-2)] outline-none placeholder:italic placeholder:text-[var(--db-faint)] sm:text-lg"
              disabled={isSubmitting}
            />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !inputValue.trim()}
                className="flex items-center justify-center space-x-2 rounded-full border border-[var(--db-border)] px-4 py-2.5 text-sm text-[var(--db-ink-2)] transition-colors hover:border-[var(--db-accent)] hover:text-[var(--db-accent)] disabled:opacity-40"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>保存</span>}
              </button>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || fragments.length === 0}
                className="flex items-center justify-center space-x-2 rounded-full bg-[var(--db-accent)] px-5 py-2.5 text-white shadow-sm shadow-[var(--db-accent)]/20 transition-colors hover:bg-[var(--db-accent-dim)] disabled:opacity-50"
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

      {/* 移动端浮层：快速输入条 + 底部 Nav + 写碎片 sheet */}
      <MobileQuickInputBar
        onOpen={() => {
          setMobileSheetOpen(true)
          requestAnimationFrame(() => mobileSheetInputRef.current?.focus())
        }}
        nextIndex={fragments.length + 1}
      />
      <MobileBottomNav />
      <InstallPrompt fragmentCount={fragments.length} />

      <BottomSheet
        open={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        title={`写一条碎片 · 第 ${fragments.length + 1} 条`}
      >
        <form onSubmit={handleMobileSubmit} className="flex flex-col gap-3">
          <textarea
            ref={mobileSheetInputRef as unknown as React.RefObject<HTMLTextAreaElement>}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="今天有什么想法？"
            rows={4}
            autoFocus
            className="w-full resize-none rounded-2xl border border-[var(--db-border)] bg-[var(--db-surface)] px-4 py-3 text-base leading-relaxed text-[var(--db-ink)] outline-none placeholder:italic placeholder:text-[var(--db-faint)] focus:border-[var(--db-accent)]"
            disabled={isSubmitting}
          />
          {errorMsg && (
            <p className="text-sm text-[var(--db-error)]">{errorMsg}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setMobileSheetOpen(false)}
              className="rounded-full px-4 py-2 text-sm text-[var(--db-muted)]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !inputValue.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--db-accent)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_4px_14px_rgba(212,163,115,0.3)] transition-colors hover:bg-[var(--db-accent-dim)] disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              <span>{isSubmitting ? '保存中…' : '存为碎片'}</span>
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  )
}

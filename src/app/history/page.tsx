'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, ArrowLeft, List, Loader2 } from 'lucide-react'
import { getAllDiaryEntries } from '@/lib/actions'
import type { DiaryEntry } from '@/lib/supabase'
import { MobileBottomNav } from '@/components/MobileBottomNav'

function formatEntryDate(dateStr: string): { display: string; weekday: string } {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return {
    display: d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }),
    weekday: d.toLocaleDateString('zh-CN', { weekday: 'long' }),
  }
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadEntries()
  }, [])

  async function loadEntries() {
    try {
      const data = await getAllDiaryEntries()
      setEntries(data)
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredEntries = entries.filter((entry) => {
    const text = `${entry.session_date} ${entry.title} ${entry.full_diary} ${entry.key_points}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

  return (
    <div className="flex min-h-screen justify-center bg-[var(--db-bg)] px-4 pb-28 pt-8 text-[var(--db-ink)] sm:px-6 md:pb-20 md:pt-24 lg:pb-32">
      <div className="w-full max-w-4xl">
        <header className="mb-12 border-b border-[var(--db-border)] pb-4 sm:mb-20">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-[var(--db-muted)] transition-colors hover:text-[var(--db-ink-2)]"
            >
              <ArrowLeft className="h-4 w-4" />
              返回工作台
            </Link>
            <p className="hidden text-xs uppercase tracking-[0.25em] text-[var(--db-faint)] sm:block">归档浏览</p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="group relative flex-1 lg:max-w-md">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索日记内容……"
                className="w-full bg-transparent pl-8 text-lg text-[var(--db-ink-2)] outline-none placeholder:italic placeholder:text-[var(--db-faint)] sm:text-xl"
              />
              <Search className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--db-faint)] transition-colors group-focus-within:text-[var(--db-accent)]" />
            </div>

            <div className="flex items-center space-x-6 text-sm uppercase tracking-widest text-[var(--db-ink-2)]">
              <button type="button" className="flex items-center space-x-2 font-semibold text-[var(--db-accent)]">
                <List className="h-4 w-4" />
                <span className="border-b border-[var(--db-accent)] pb-0.5">列表</span>
              </button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--db-accent)]" />
          </div>
        ) : (
          <>
            <div className="space-y-10 sm:space-y-12">
              {filteredEntries.map((entry) => {
                const { display, weekday } = formatEntryDate(entry.session_date)

                return (
                  <Link
                    key={entry.id}
                    href={`/preview?date=${entry.session_date}`}
                    className="group block w-full cursor-pointer text-left"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-baseline md:gap-12">
                      <div className="w-32 shrink-0">
                        <h3 className="text-xl italic text-[var(--db-ink)]">{display}</h3>
                        <p className="mt-1 text-xs uppercase tracking-widest text-[var(--db-muted)]">{weekday}</p>
                      </div>
                      <div className="relative flex-1">
                        <div
                          className={`absolute -left-4 top-2 h-1.5 w-1.5 rounded-full ${
                            entry.is_highlighted ? 'bg-[var(--db-accent)]' : 'border border-[var(--db-accent)]'
                          }`}
                        />
                        <h4 className="mb-3 text-xl text-[var(--db-ink-2)] transition-colors group-hover:text-[var(--db-accent)] sm:text-2xl">
                          {entry.title}
                        </h4>
                      </div>
                    </div>
                    <div className="mt-10 h-px w-full bg-[var(--db-border)] opacity-50 sm:mt-12" />
                  </Link>
                )
              })}
            </div>

            <div className="mt-16 text-center sm:mt-24">
              {entries.length === 0 ? (
                <div>
                  <p className="text-sm italic text-[var(--db-faint)]">暂无日记记录。</p>
                  <p className="mt-2 text-xs text-[var(--db-faint)]">前往工作台生成第一篇日记。</p>
                </div>
              ) : filteredEntries.length === 0 ? (
                <p className="text-sm italic text-[var(--db-faint)]">未找到匹配的日记。</p>
              ) : (
                <p className="text-sm italic text-[var(--db-faint)]">更早的日记已安全归档……</p>
              )}
            </div>
          </>
        )}
      </div>
      <MobileBottomNav />
    </div>
  )
}

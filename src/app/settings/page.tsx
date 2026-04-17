'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Archive, Trash2, AlertTriangle, Loader2, Check, Link2, Unlink } from 'lucide-react'
import { getAllDiaryEntries, getTemplates, createTemplate, updateTemplate } from '@/lib/actions'
import type { DiaryTemplate } from '@/lib/supabase'

type NotionStatus =
  | { connected: false }
  | {
      connected: true
      workspace_name: string | null
      workspace_icon: string | null
      data_source_id: string | null
      data_source_title: string | null
    }

const DEFAULT_PROMPT = `你是一位专业的 AI 日记助手。用户在一天中记录了多条碎片化的想法和笔记。
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
不要添加任何额外的解释性文字。`

export default function SettingsPage() {
  // ── Prompt template state ─────────────────────────────────────────────────
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_PROMPT)
  const [loadingPrompt, setLoadingPrompt] = useState(true)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [promptError, setPromptError] = useState('')

  // ── Data management state ─────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  // ── Notion integration state ──────────────────────────────────────────────
  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null)
  const [loadingNotion, setLoadingNotion] = useState(true)
  const [notionDatabases, setNotionDatabases] = useState<Array<{ id: string; title: string }>>([])
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [selectedDb, setSelectedDb] = useState('')
  const [savingDb, setSavingDb] = useState(false)
  const [notionMsg, setNotionMsg] = useState('')

  async function refreshNotionStatus() {
    setLoadingNotion(true)
    try {
      const res = await fetch('/api/notion/status')
      if (res.ok) {
        const data = (await res.json()) as NotionStatus
        setNotionStatus(data)
        if (data.connected) setSelectedDb(data.data_source_id ?? '')
      }
    } finally {
      setLoadingNotion(false)
    }
  }

  async function loadNotionDatabases() {
    setLoadingDatabases(true)
    setNotionMsg('')
    try {
      const res = await fetch('/api/notion/databases')
      const data = await res.json()
      if (!res.ok) {
        setNotionMsg(data.error ?? '加载失败')
        return
      }
      setNotionDatabases(data.databases ?? [])
    } catch (err) {
      setNotionMsg(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoadingDatabases(false)
    }
  }

  async function handleSelectDatabase() {
    if (!selectedDb) return
    setSavingDb(true)
    setNotionMsg('')
    try {
      const res = await fetch('/api/notion/select-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database_id: selectedDb }),
      })
      const data = await res.json()
      if (!res.ok) { setNotionMsg(data.error ?? '保存失败'); return }
      setNotionMsg('已绑定数据库。')
      await refreshNotionStatus()
    } catch (err) {
      setNotionMsg(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSavingDb(false)
    }
  }

  async function handleDisconnectNotion() {
    setNotionMsg('')
    try {
      const res = await fetch('/api/notion/disconnect', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setNotionMsg(data.error ?? '断开失败')
        return
      }
      setNotionDatabases([])
      setSelectedDb('')
      await refreshNotionStatus()
    } catch (err) {
      setNotionMsg(err instanceof Error ? err.message : '断开失败')
    }
  }

  useEffect(() => {
    refreshNotionStatus()
    // Pick up ?notion=connected|denied|invalid|error hint from the OAuth redirect.
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('notion')
      if (p === 'connected') setNotionMsg('Notion 已连接，请在下方选择一个目标数据库。')
      else if (p === 'denied') setNotionMsg('你取消了 Notion 授权。')
      else if (p === 'invalid') setNotionMsg('授权状态无效，请重试。')
      else if (p === 'error') setNotionMsg('连接 Notion 时出错，请重试。')
    }
  }, [])

  // Load template from Supabase on mount
  useEffect(() => {
    getTemplates()
      .then((list) => {
        if (list.length > 0) {
          setTemplateId(list[0].id)
          setPrompt(list[0].prompt)
          setSavedPrompt(list[0].prompt)
        }
        // If empty, show DEFAULT_PROMPT in editor but don't auto-save
      })
      .catch(() => {})
      .finally(() => setLoadingPrompt(false))
  }, [])

  async function handleSavePrompt() {
    if (!prompt.trim()) {
      setPromptError('提示词不能为空。')
      return
    }
    setSavingPrompt(true)
    setPromptError('')
    setSaveSuccess(false)
    try {
      let saved: DiaryTemplate
      if (templateId) {
        saved = await updateTemplate(templateId, { prompt: prompt.trim() })
      } else {
        saved = await createTemplate('默认模板', '', prompt.trim())
        setTemplateId(saved.id)
      }
      setSavedPrompt(saved.prompt)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : '保存失败，请重试。')
    } finally {
      setSavingPrompt(false)
    }
  }

  function handleReset() {
    setPrompt(DEFAULT_PROMPT)
    setPromptError('')
  }

  const isDirty = prompt !== savedPrompt

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    setIsExporting(true)
    setStatusMsg('')
    try {
      const entries = await getAllDiaryEntries()
      if (entries.length === 0) { setStatusMsg('暂无日记可导出。'); return }

      const allContent = entries
        .map((entry) =>
          [
            `# ${entry.title}`,
            `**日期：** ${entry.session_date}`,
            '',
            entry.full_diary,
            '',
            '---',
            '',
            entry.key_points,
            '',
            '---',
            '',
            entry.mentor_insights,
            '',
            '---',
            '',
            entry.action_items,
          ]
            .filter((s) => s !== undefined)
            .join('\n')
        )
        .join('\n\n\n===\n\n\n')

      const blob = new Blob([allContent], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `diarybuddy-archive-${new Date().toISOString().split('T')[0]}.md`
      link.click()
      URL.revokeObjectURL(url)
      setStatusMsg(`已导出 ${entries.length} 篇日记。`)
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : '导出失败。')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#FDFBF7] px-4 pb-20 pt-24 text-[#333333] sm:px-6 lg:pb-32">
      <div className="w-full max-w-2xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-[#8C7B6A] transition-colors hover:text-[#4A4A4A]"
        >
          <ArrowLeft className="h-4 w-4" />
          返回工作台
        </Link>

        <header className="mb-16 text-center">
          <h1 className="text-3xl font-normal tracking-wide text-[#2B2A27] sm:text-4xl">偏好设置</h1>
          <div className="mt-6 flex justify-center">
            <div className="h-px w-16 bg-[#D4A373] opacity-60" />
          </div>
        </header>

        <div className="space-y-16 sm:space-y-20">

          {/* ── 日记模板 ── */}
          <section>
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-2xl italic text-[#4A4A4A]">日记模板</h2>
                <p className="mt-1 text-sm italic text-[#8C7B6A]">
                  生成日记时发送给 AI 的系统指令，可直接编辑。
                </p>
              </div>
              {!loadingPrompt && (
                <div className="flex items-center gap-3">
                  {isDirty && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs text-[#8C7B6A] hover:text-[#4A4A4A]"
                    >
                      重置默认
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSavePrompt}
                    disabled={savingPrompt || (!isDirty && templateId !== null)}
                    className="flex items-center gap-1.5 rounded-full bg-[#D4A373] px-4 py-1.5 text-sm text-white transition-colors hover:bg-[#C39363] disabled:opacity-40"
                  >
                    {savingPrompt ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : saveSuccess ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : null}
                    {saveSuccess ? '已保存' : '保存'}
                  </button>
                </div>
              )}
            </div>

            {loadingPrompt ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[#D4A373]" />
              </div>
            ) : (
              <>
                <textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setPromptError('') }}
                  rows={22}
                  className="w-full resize-y rounded-2xl border border-[#EAE1D3] bg-[#F6F3EE] px-5 py-4 font-mono text-sm leading-relaxed text-[#4A4A4A] outline-none transition-colors focus:border-[#D4A373] focus:ring-1 focus:ring-[#D4A373]/30"
                  spellCheck={false}
                />
                {promptError && (
                  <p className="mt-2 text-xs text-red-500">{promptError}</p>
                )}
                {!templateId && !isDirty && (
                  <p className="mt-2 text-xs italic text-[#B4AC9F]">
                    当前显示的是默认指令，编辑后点击「保存」即可存入数据库。
                  </p>
                )}
              </>
            )}
          </section>

          {/* ── Notion 集成 ── */}
          <section>
            <h2 className="mb-4 text-2xl italic text-[#4A4A4A]">Notion 集成</h2>
            <p className="mb-6 max-w-md text-sm italic leading-relaxed text-[#8C7B6A]">
              连接你的 Notion 工作区，将每篇日记一键同步到指定的 Database。
            </p>

            {notionMsg && (
              <div className="mb-4 rounded-lg border border-[#EAE1D3] bg-[#F6F3EE] px-4 py-3 text-sm text-[#6B5C4C]">
                {notionMsg}
              </div>
            )}

            {loadingNotion ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[#D4A373]" />
              </div>
            ) : !notionStatus?.connected ? (
              <a
                href="/api/notion/oauth/start"
                className="inline-flex items-center gap-2 rounded-full bg-[#D4A373] px-5 py-2 text-sm text-white transition-colors hover:bg-[#C39363]"
              >
                <Link2 className="h-4 w-4" />
                连接 Notion
              </a>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-3 text-sm text-[#4A4A4A]">
                  {notionStatus.workspace_icon && (
                    <span aria-hidden className="text-xl leading-none">{notionStatus.workspace_icon}</span>
                  )}
                  <span>
                    已连接到 <strong>{notionStatus.workspace_name ?? 'Notion'}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnectNotion}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-[#8C7B6A] hover:text-red-600"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    断开
                  </button>
                </div>

                {notionStatus.data_source_id && notionStatus.data_source_title ? (
                  <p className="text-sm text-[#6B5C4C]">
                    目标 Database：<strong>{notionStatus.data_source_title}</strong>
                  </p>
                ) : (
                  <p className="text-sm italic text-[#B4AC9F]">
                    还没有选择目标 Database——请先从下方列表选一个。
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={loadNotionDatabases}
                    disabled={loadingDatabases}
                    className="rounded-full border border-[#EAE1D3] px-4 py-1.5 text-sm text-[#6B5C4C] transition-colors hover:border-[#D4A373]/50 hover:text-[#D4A373] disabled:opacity-50"
                  >
                    {loadingDatabases ? '加载中…' : notionDatabases.length > 0 ? '刷新列表' : '加载我的 Database'}
                  </button>

                  {notionDatabases.length > 0 && (
                    <>
                      <select
                        value={selectedDb}
                        onChange={(e) => setSelectedDb(e.target.value)}
                        className="rounded-full border border-[#EAE1D3] bg-white px-4 py-1.5 text-sm text-[#4A4A4A] outline-none focus:border-[#D4A373]"
                      >
                        <option value="">选择一个 Database…</option>
                        {notionDatabases.map((db) => (
                          <option key={db.id} value={db.id}>{db.title}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleSelectDatabase}
                        disabled={!selectedDb || savingDb}
                        className="rounded-full bg-[#D4A373] px-4 py-1.5 text-sm text-white transition-colors hover:bg-[#C39363] disabled:opacity-50"
                      >
                        {savingDb ? '保存中…' : '绑定此 Database'}
                      </button>
                    </>
                  )}
                </div>

                <p className="text-xs italic text-[#B4AC9F]">
                  提示：若列表为空，请回到 Notion 将目标 Database 分享给 DiaryBuddy Integration。
                </p>
              </div>
            )}
          </section>

          {/* ── 数据与归档 ── */}
          <section>
            <h2 className="mb-4 text-2xl italic text-[#4A4A4A]">数据与归档</h2>
            <p className="mb-10 max-w-md text-sm italic leading-relaxed text-[#8C7B6A]">
              你的日记在这里静静沉淀，随时可以浏览，也可以随时带走。
            </p>

            {statusMsg && (
              <div className="mb-6 rounded-lg border border-[#EAE1D3] bg-[#F6F3EE] px-4 py-3 text-sm text-[#6B5C4C]">
                {statusMsg}
              </div>
            )}

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="group flex w-full items-center space-x-4 border border-transparent px-4 py-3 text-left transition-all hover:border-[#EAE1D3] disabled:opacity-50"
              >
                <Archive className="h-5 w-5 text-[#B4AC9F] transition-colors group-hover:text-[#D4A373]" />
                <span className="text-lg text-[#6B5C4C] transition-colors group-hover:text-[#2B2A27] sm:text-xl">
                  {isExporting ? '导出中……' : '导出归档到本地'}
                </span>
              </button>

              {!showClearConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="group flex w-full items-center space-x-4 border border-transparent px-4 py-3 text-left transition-all hover:border-[#EAE1D3]"
                >
                  <Trash2 className="h-5 w-5 text-[#B4AC9F] transition-colors group-hover:text-[#ba1a1a]" />
                  <span className="text-lg text-[#6B5C4C] transition-colors group-hover:text-[#93000a] sm:text-xl">
                    清除存储记录
                  </span>
                </button>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-red-800">此操作将永久删除数据库中的所有日记条目。</p>
                      <p className="mt-1 text-xs text-red-600">此操作不可撤销，请先导出归档。</p>
                      <div className="mt-4 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(false)}
                          className="rounded-full border border-[#EAE1D3] px-4 py-1.5 text-sm text-[#6B5C4C] hover:bg-white"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700"
                          onClick={() => {
                            setShowClearConfirm(false)
                            setStatusMsg('清除功能需要额外实现以确保安全。')
                          }}
                        >
                          我已了解，清除全部
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── 关于 ── */}
          <section>
            <h2 className="mb-4 text-2xl italic text-[#4A4A4A]">关于</h2>
            <div className="space-y-2 text-sm text-[#8C7B6A]">
              <p>AI 模型：Gemini 2.5 Flash</p>
              <p>存储：Supabase PostgreSQL</p>
              <p>框架：Next.js</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

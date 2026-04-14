'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Plus, Archive, Trash2, ArrowLeft, AlertTriangle } from 'lucide-react'
import { getAllDiaryEntries } from '@/lib/actions'

const templates = ['学术回顾', '每日反思', '极简笔记']

export default function SettingsPage() {
  const [activeTemplate, setActiveTemplate] = useState('学术回顾')
  const [isExporting, setIsExporting] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  async function handleExport() {
    setIsExporting(true)
    setStatusMsg('')
    try {
      const entries = await getAllDiaryEntries()
      if (entries.length === 0) {
        setStatusMsg('暂无日记可导出。')
        return
      }

      const allContent = entries
        .map((entry) => {
          const sections = [
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
          return sections
        })
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
          {/* 模板选择 */}
          <section>
            <h2 className="mb-8 text-2xl italic text-[#4A4A4A]">日记模板</h2>

            <div className="space-y-4 sm:space-y-6">
              {templates.map((template) => {
                const isActive = template === activeTemplate
                return (
                  <button
                    key={template}
                    type="button"
                    onClick={() => setActiveTemplate(template)}
                    className="group flex w-full items-center justify-between border-b border-[#EAE1D3] pb-4 text-left"
                  >
                    <span
                      className={`text-lg transition-colors sm:text-xl ${
                        isActive ? 'text-[#2B2A27]' : 'text-[#6B5C4C] group-hover:text-[#4A4A4A]'
                      }`}
                    >
                      {template}
                    </span>
                    {isActive ? (
                      <Check className="h-5 w-5 text-[#D4A373]" />
                    ) : null}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="group mt-8 flex items-center space-x-2 rounded px-2 py-1 text-[#8C7B6A] transition-colors hover:text-[#D4A373]"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm uppercase tracking-wider">创建模板</span>
            </button>
          </section>

          {/* 数据管理 */}
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

          {/* 关于 */}
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

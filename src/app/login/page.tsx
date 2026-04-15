'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { BookOpenText, Mail, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || isLoading) return

    setIsLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setIsLoading(false)
    } else {
      setSent(true)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] px-4 text-[#333333]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-12 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D4A373]/15">
            <BookOpenText className="h-6 w-6 text-[#D4A373]" />
          </div>
          <h1 className="text-2xl font-normal italic tracking-wide text-[#2B2A27]">Diarybuddy</h1>
          <p className="text-sm italic text-[#8C7B6A]">你的私人 AI 日记本</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-[#EAE1D3] bg-white px-8 py-10 text-center shadow-sm">
            <Mail className="mx-auto mb-4 h-8 w-8 text-[#D4A373]" />
            <h2 className="mb-2 text-lg text-[#2B2A27]">请查看你的邮箱</h2>
            <p className="text-sm leading-relaxed text-[#8C7B6A]">
              我们已将登录链接发送至 <strong className="text-[#4A4A4A]">{email}</strong>，
              点击邮件中的链接即可登录，无需密码。
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setEmail('') }}
              className="mt-6 text-xs text-[#B4AC9F] underline underline-offset-2 hover:text-[#8C7B6A]"
            >
              使用其他邮箱
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#EAE1D3] bg-white px-8 py-10 shadow-sm"
          >
            <h2 className="mb-1 text-lg text-[#2B2A27]">登录</h2>
            <p className="mb-8 text-sm text-[#8C7B6A]">
              输入你的邮箱，我们将向你发送一个魔法登录链接。
            </p>

            <div className="mb-6">
              <label htmlFor="email" className="mb-2 block text-xs uppercase tracking-widest text-[#8C7B6A]">
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-[#EAE1D3] bg-[#FDFBF7] px-4 py-3 text-base text-[#4A4A4A] outline-none placeholder:text-[#C4B9AA] focus:border-[#D4A373] focus:ring-2 focus:ring-[#D4A373]/20"
              />
            </div>

            {error && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#D4A373] py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#C39363] disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {isLoading ? '发送中……' : '发送魔法链接'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

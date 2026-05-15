'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { BookOpenText, Mail, Loader2, KeyRound } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || isLoading) return

    setIsLoading(true)
    setError('')

    const supabase = createClient()
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${appOrigin}/auth/callback`,
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

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    const trimmedCode = code.trim()
    if (!trimmedCode || isVerifying) return

    setIsVerifying(true)
    setError('')

    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: trimmedCode,
      type: 'email',
    })

    if (verifyError) {
      setError(verifyError.message)
      setIsVerifying(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="h5-page h5-page-x flex flex-col items-center justify-center bg-[var(--db-bg)] py-[calc(env(safe-area-inset-top,0px)+2rem)] text-[var(--db-ink)]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-12 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--db-accent)]/15">
            <BookOpenText className="h-6 w-6 text-[var(--db-accent)]" />
          </div>
          <h1 className="text-2xl font-normal italic tracking-wide text-[var(--db-ink)]">Diarybuddy</h1>
          <p className="text-sm italic text-[var(--db-muted)]">你的私人 AI 日记本</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-[var(--db-border)] bg-[var(--db-card)] px-5 py-8 shadow-sm sm:px-8 sm:py-10">
            <div className="mb-6 text-center">
              <Mail className="mx-auto mb-4 h-8 w-8 text-[var(--db-accent)]" />
              <h2 className="mb-2 text-lg text-[var(--db-ink)]">请查看你的邮箱</h2>
              <p className="h5-text-wrap text-sm leading-relaxed text-[var(--db-muted)]">
                我们已将登录邮件发送至 <strong className="text-[var(--db-ink-2)]">{email}</strong>
              </p>
              <p className="mt-3 text-xs italic text-[var(--db-faint)]">
                首次使用会自动为你创建账号。
              </p>
            </div>

            <form onSubmit={handleVerifyCode}>
              <label htmlFor="code" className="mb-2 block text-xs uppercase tracking-widest text-[var(--db-muted)]">
                输入 6 位验证码
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="mb-3 w-full rounded-lg border border-[var(--db-border)] bg-[var(--db-bg)] px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-[var(--db-ink-2)] outline-none placeholder:text-[var(--db-faint)] focus:border-[var(--db-accent)] focus:ring-2 focus:ring-[var(--db-accent)]/20"
                autoFocus
              />

              {error && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={isVerifying || code.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--db-accent)] py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--db-accent-dim)] disabled:opacity-50"
              >
                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {isVerifying ? '验证中……' : '验证并登录'}
              </button>
            </form>

            <div className="mt-6 border-t border-[var(--db-border)] pt-4 text-center">
              <p className="text-xs text-[var(--db-faint)]">
                也可以直接点击邮件中的登录链接。
              </p>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(''); setCode(''); setError('') }}
                className="mt-3 text-xs text-[var(--db-faint)] underline underline-offset-2 hover:text-[var(--db-muted)]"
              >
                使用其他邮箱
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[var(--db-border)] bg-[var(--db-card)] px-5 py-8 shadow-sm sm:px-8 sm:py-10"
          >
            <h2 className="mb-1 text-lg text-[var(--db-ink)]">欢迎</h2>
            <p className="mb-8 text-sm text-[var(--db-muted)]">
              输入邮箱即可登录或创建新账号，无需密码。
            </p>

            <div className="mb-6">
              <label htmlFor="email" className="mb-2 block text-xs uppercase tracking-widest text-[var(--db-muted)]">
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-[var(--db-border)] bg-[var(--db-bg)] px-4 py-3 text-base text-[var(--db-ink-2)] outline-none placeholder:text-[var(--db-faint)] focus:border-[var(--db-accent)] focus:ring-2 focus:ring-[var(--db-accent)]/20"
              />
            </div>

            {error && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--db-accent)] py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--db-accent-dim)] disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {isLoading ? '发送中……' : '发送登录邮件'}
            </button>

            <p className="mt-4 text-center text-xs italic text-[var(--db-faint)]">
              邮件中包含登录链接和 6 位验证码，二选一即可。
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

function safeRedirect(origin: string, path: string) {
  const url = new URL(path, origin)
  if (url.origin !== origin) return `${origin}/`
  return url.toString()
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get('next')
  const fallback = next ? safeRedirect(origin, next) : `${origin}/`

  // Magic Link (OTP) flow — Supabase sends token_hash + type
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(fallback)
    }
  }

  // PKCE flow fallback — Supabase sends code
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(fallback)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

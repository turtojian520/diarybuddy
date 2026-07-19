import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'

const AUTH_REQUEST_TIMEOUT_MS = 5_000

async function fetchWithAuthTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const timeoutSignal = AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS)
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal

  return fetch(input, { ...init, signal })
}

/** Creates a Supabase client that refreshes auth cookies without blocking indefinitely. */
export function createProxyClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: fetchWithAuthTimeout,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}

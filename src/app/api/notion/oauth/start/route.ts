import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { signState } from '@/lib/crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.NOTION_OAUTH_CLIENT_ID
  const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Notion OAuth env vars missing' }, { status: 500 })
  }

  const state = signState({
    user_id: user.id,
    nonce: crypto.randomBytes(12).toString('base64url'),
    iat: Date.now(),
  })

  const url = new URL('https://api.notion.com/v1/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('owner', 'user')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  return NextResponse.redirect(url.toString())
}

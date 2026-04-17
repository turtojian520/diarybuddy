import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptSecret, verifyState } from '@/lib/crypto'

type NotionTokenResponse = {
  access_token: string
  token_type?: string
  bot_id?: string
  workspace_id?: string
  workspace_name?: string
  workspace_icon?: string
  owner?: unknown
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(`${origin}/settings?notion=denied`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?notion=invalid`)
  }

  const parsed = verifyState<{ user_id: string }>(state)
  if (!parsed || parsed.user_id !== user.id) {
    return NextResponse.redirect(`${origin}/settings?notion=invalid`)
  }

  const clientId = process.env.NOTION_OAUTH_CLIENT_ID
  const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET
  const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: 'Notion OAuth env vars missing' }, { status: 500 })
  }

  let token: NotionTokenResponse
  try {
    const res = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[/api/notion/oauth/callback] token exchange failed:', res.status, body)
      return NextResponse.redirect(`${origin}/settings?notion=error`)
    }
    token = (await res.json()) as NotionTokenResponse
  } catch (err) {
    console.error('[/api/notion/oauth/callback] token exchange error:', err)
    return NextResponse.redirect(`${origin}/settings?notion=error`)
  }

  const { error: upsertError } = await supabase
    .from('notion_connections')
    .upsert(
      {
        user_id: user.id,
        access_token_enc: encryptSecret(token.access_token),
        bot_id: token.bot_id ?? null,
        workspace_id: token.workspace_id ?? null,
        workspace_name: token.workspace_name ?? null,
        workspace_icon: token.workspace_icon ?? null,
        updated_at: new Date().toISOString(),
        // Reset selected database on reconnect so user re-picks it.
        data_source_id: null,
        data_source_title: null,
        title_prop_name: null,
        date_prop_name: null,
      },
      { onConflict: 'user_id' },
    )

  if (upsertError) {
    console.error('[/api/notion/oauth/callback] DB upsert failed:', upsertError.message)
    return NextResponse.redirect(`${origin}/settings?notion=error`)
  }

  return NextResponse.redirect(`${origin}/settings?notion=connected`)
}

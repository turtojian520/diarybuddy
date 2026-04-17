import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNotionConnection } from '@/lib/notion/client'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await getNotionConnection()
    if (!conn) return NextResponse.json({ connected: false })
    return NextResponse.json({
      connected: true,
      workspace_name: conn.workspace_name,
      workspace_icon: conn.workspace_icon,
      data_source_id: conn.data_source_id,
      data_source_title: conn.data_source_title,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/notion/status] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

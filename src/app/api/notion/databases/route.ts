import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildNotionClient, getNotionConnection } from '@/lib/notion/client'

type DataSourceSummary = { id: string; title: string }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await getNotionConnection()
    if (!conn) return NextResponse.json({ error: 'Not connected to Notion' }, { status: 409 })

    const notion = buildNotionClient(conn)
    const response = await notion.search({
      filter: { property: 'object', value: 'data_source' },
      page_size: 50,
    })

    const databases: DataSourceSummary[] = response.results
      .filter((r) => r.object === 'data_source')
      .map((ds) => {
        const titleArr = (ds as unknown as { title?: Array<{ plain_text?: string }> }).title ?? []
        const plain = titleArr.map((t) => t.plain_text ?? '').join('').trim()
        return { id: ds.id, title: plain || '（未命名数据库）' }
      })

    return NextResponse.json({ databases })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/notion/databases] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

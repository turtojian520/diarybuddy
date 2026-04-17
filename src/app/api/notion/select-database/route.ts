import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildNotionClient, getNotionConnection } from '@/lib/notion/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { database_id: dataSourceId } = (await request.json()) as { database_id?: string }
    if (!dataSourceId) {
      return NextResponse.json({ error: 'database_id required' }, { status: 400 })
    }

    const conn = await getNotionConnection()
    if (!conn) return NextResponse.json({ error: 'Not connected to Notion' }, { status: 409 })

    const notion = buildNotionClient(conn)
    const ds = await notion.dataSources.retrieve({ data_source_id: dataSourceId })

    const properties = (ds as unknown as { properties?: Record<string, { type: string }> }).properties ?? {}
    const titlePropName = Object.entries(properties).find(([, v]) => v.type === 'title')?.[0]
    const datePropName = Object.entries(properties).find(([, v]) => v.type === 'date')?.[0] ?? null
    if (!titlePropName) {
      return NextResponse.json({ error: 'Database has no title property' }, { status: 400 })
    }

    const titleArr = (ds as unknown as { title?: Array<{ plain_text?: string }> }).title ?? []
    const dsTitle = titleArr.map((t) => t.plain_text ?? '').join('').trim() || null

    const { error } = await supabase
      .from('notion_connections')
      .update({
        data_source_id: dataSourceId,
        data_source_title: dsTitle,
        title_prop_name: titlePropName,
        date_prop_name: datePropName,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, database_title: dsTitle })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/notion/select-database] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDiaryEntry } from '@/lib/actions'
import { buildNotionClient, getNotionConnection } from '@/lib/notion/client'
import { buildDiaryBlocks, NOTION_CHILDREN_PAGE_LIMIT } from '@/lib/notion/markdown-to-blocks'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { date } = (await request.json()) as { date?: string }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
    }

    const conn = await getNotionConnection()
    if (!conn) {
      return NextResponse.json({ error: 'Not connected to Notion', needsConnect: true }, { status: 409 })
    }
    if (!conn.data_source_id || !conn.title_prop_name) {
      return NextResponse.json({ error: 'No Notion database selected', needsDatabase: true }, { status: 409 })
    }

    const entry = await getDiaryEntry(date)
    if (!entry) {
      return NextResponse.json({ error: 'No diary entry found for this date' }, { status: 404 })
    }

    const blocks = buildDiaryBlocks({
      full_diary: entry.full_diary,
      key_points: entry.key_points,
      mentor_insights: entry.mentor_insights,
      action_items: entry.action_items,
    })

    const notion = buildNotionClient(conn)

    const properties: Record<string, unknown> = {
      [conn.title_prop_name]: {
        title: [{ type: 'text', text: { content: entry.title || `Diary ${date}` } }],
      },
    }
    if (conn.date_prop_name) {
      properties[conn.date_prop_name] = { date: { start: date } }
    }

    const firstBatch = blocks.slice(0, NOTION_CHILDREN_PAGE_LIMIT)
    const rest = blocks.slice(NOTION_CHILDREN_PAGE_LIMIT)

    const page = await notion.pages.create({
      parent: { data_source_id: conn.data_source_id },
      properties: properties as Parameters<typeof notion.pages.create>[0]['properties'],
      children: firstBatch as Parameters<typeof notion.pages.create>[0]['children'],
    })

    // Append any overflow blocks in chunks of 100.
    for (let i = 0; i < rest.length; i += NOTION_CHILDREN_PAGE_LIMIT) {
      const chunk = rest.slice(i, i + NOTION_CHILDREN_PAGE_LIMIT)
      await notion.blocks.children.append({
        block_id: page.id,
        children: chunk as Parameters<typeof notion.blocks.children.append>[0]['children'],
      })
    }

    const url = (page as unknown as { url?: string }).url ?? null
    return NextResponse.json({ success: true, url, page_id: page.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/export/notion] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

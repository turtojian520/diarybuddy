import { Client } from '@notionhq/client'
import { createClient as createSupabaseServer } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'

export type NotionConnection = {
  id: string
  user_id: string
  access_token_enc: string
  bot_id: string | null
  workspace_id: string | null
  workspace_name: string | null
  workspace_icon: string | null
  data_source_id: string | null
  data_source_title: string | null
  title_prop_name: string | null
  date_prop_name: string | null
  connected_at: string
  updated_at: string
}

export async function getNotionConnection(): Promise<NotionConnection | null> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('notion_connections')
    .select('*')
    .maybeSingle()
  if (error) throw new Error(`Failed to load Notion connection: ${error.message}`)
  return (data ?? null) as NotionConnection | null
}

export function buildNotionClient(conn: NotionConnection): Client {
  const token = decryptSecret(conn.access_token_enc)
  return new Client({ auth: token })
}

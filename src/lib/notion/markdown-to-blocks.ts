type Annotations = { bold?: boolean; italic?: boolean; code?: boolean }
type RichText = {
  type: 'text'
  text: { content: string; link?: { url: string } | null }
  annotations?: Annotations
}
// Notion block shapes we emit (simplified — the SDK accepts these object literals).
// Using unknown here avoids pulling the full Notion type graph into our code.
type NotionBlock = Record<string, unknown>

const NOTION_RICH_TEXT_LIMIT = 2000

function parseInline(raw: string): RichText[] {
  if (!raw) return []
  const tokens: RichText[] = []
  const regex = /(\*\*([^*]+?)\*\*)|(\*([^*\n]+?)\*)|(`([^`\n]+?)`)/g
  let cursor = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(raw)) !== null) {
    if (m.index > cursor) {
      tokens.push(plain(raw.slice(cursor, m.index)))
    }
    if (m[1]) tokens.push(plain(m[2], { bold: true }))
    else if (m[3]) tokens.push(plain(m[4], { italic: true }))
    else if (m[5]) tokens.push(plain(m[6], { code: true }))
    cursor = m.index + m[0].length
  }
  if (cursor < raw.length) tokens.push(plain(raw.slice(cursor)))
  return tokens.flatMap(chunkRichText)
}

function plain(content: string, annotations?: Annotations): RichText {
  return {
    type: 'text',
    text: { content, link: null },
    ...(annotations ? { annotations } : {}),
  }
}

function chunkRichText(rt: RichText): RichText[] {
  const content = rt.text.content
  if (content.length <= NOTION_RICH_TEXT_LIMIT) return [rt]
  const chunks: RichText[] = []
  for (let i = 0; i < content.length; i += NOTION_RICH_TEXT_LIMIT) {
    chunks.push({
      ...rt,
      text: { ...rt.text, content: content.slice(i, i + NOTION_RICH_TEXT_LIMIT) },
    })
  }
  return chunks
}

function wrap(type: string, extra: Record<string, unknown>): NotionBlock {
  return { object: 'block', type, [type]: extra }
}

function paragraphBlock(richText: RichText[]): NotionBlock {
  return wrap('paragraph', { rich_text: richText })
}

export function markdownToBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: NotionBlock[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') continue

    if (trimmed === '---') {
      blocks.push(wrap('divider', {}))
      continue
    }

    // Headings: Notion has only heading_1/2/3 — map H4+ to H3.
    const hMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (hMatch) {
      const depth = Math.min(hMatch[1].length, 3)
      blocks.push(wrap(`heading_${depth}`, { rich_text: parseInline(hMatch[2]) }))
      continue
    }

    // Blockquote
    if (line.startsWith('> ') || trimmed === '>') {
      blocks.push(wrap('quote', { rich_text: parseInline(line.replace(/^>\s?/, '')) }))
      continue
    }

    // To-do
    const todoMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/)
    if (todoMatch) {
      blocks.push(wrap('to_do', {
        rich_text: parseInline(todoMatch[2]),
        checked: todoMatch[1].toLowerCase() === 'x',
      }))
      continue
    }

    // Bulleted list
    if (/^\s*[-*]\s+/.test(line)) {
      const content = line.replace(/^\s*[-*]\s+/, '')
      blocks.push(wrap('bulleted_list_item', { rich_text: parseInline(content) }))
      continue
    }

    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const content = line.replace(/^\s*\d+\.\s+/, '')
      blocks.push(wrap('numbered_list_item', { rich_text: parseInline(content) }))
      continue
    }

    // Plain paragraph
    blocks.push(paragraphBlock(parseInline(line)))
  }

  return blocks
}

export function buildDiaryBlocks(sections: {
  full_diary: string
  key_points: string
  mentor_insights: string
  action_items: string
}): NotionBlock[] {
  const parts: NotionBlock[] = []
  const order: Array<keyof typeof sections> = [
    'full_diary',
    'key_points',
    'mentor_insights',
    'action_items',
  ]
  for (const key of order) {
    const text = sections[key]
    if (!text?.trim()) continue
    if (parts.length > 0) parts.push(wrap('divider', {}))
    parts.push(...markdownToBlocks(text))
  }
  return parts
}

export const NOTION_CHILDREN_PAGE_LIMIT = 100

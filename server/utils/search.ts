import type { ComarkCMS } from '@comark/cms'

interface SearchSection {
  id: string
  title: string
  titles: string[]
  level: number
  content: string
}

/**
 * Walk every document's AST and yield one section per heading.
 *
 * `UContentSearch` consumes this shape directly via its `files` prop.
 */
export async function buildSearchSections(cms: ComarkCMS): Promise<SearchSection[]> {
  const docs = await cms.list(['content'])
  const sections: SearchSection[] = []

  for (const meta of docs) {
    const item = await cms.get(meta.path)
    if (!item || item.meta.kind !== 'document') continue

    const title = ((item.data as any)?.title as string) ?? meta.path
    const description = ((item.data as any)?.description as string) ?? ''

    sections.push({ id: item.path, title, titles: [], level: 1, content: description })

    if (!item.nodes?.length) continue

    const titles = [title]
    let previousLevel = 0
    let current = sections[sections.length - 1]!

    for (const node of item.nodes) {
      const tag = getTag(node)
      const level = headingLevel(tag)

      if (level > 0) {
        const sectionTitle = extractText(node).trim()
        if (level === 1) titles.splice(0, titles.length)
        else if (level < previousLevel) titles.splice(level - 1, titles.length - 1)
        else if (level === previousLevel) titles.pop()

        const attrs = getAttrs(node)
        current = {
          id: attrs.id ? `${item.path}#${attrs.id}` : item.path,
          title: sectionTitle,
          titles: [...titles],
          level,
          content: '',
        }
        sections.push(current)
        titles.push(sectionTitle)
        previousLevel = level
      } else {
        const text = extractText(node).trim()
        if (text) current.content = current.content ? `${current.content} ${text}` : text
      }
    }
  }

  return sections
}

function extractText(node: unknown): string {
  if (typeof node === 'string') return node
  if (!Array.isArray(node) || node[0] === null) return ''
  return node.slice(2).map(extractText).filter(Boolean).join('')
}

function getTag(node: unknown): string {
  if (Array.isArray(node) && typeof node[0] === 'string') return node[0]
  return ''
}

function getAttrs(node: unknown): Record<string, unknown> {
  if (Array.isArray(node) && node[1] && typeof node[1] === 'object') {
    return node[1] as Record<string, unknown>
  }
  return {}
}

function headingLevel(tag: string): number {
  const m = tag.match(/^h([1-6])$/)
  return m ? Number(m[1]) : 0
}

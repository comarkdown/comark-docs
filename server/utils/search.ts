import type { ComarkCMS } from '@comark/cms'

interface SearchSection {
  id: string
  title: string
  titles: string[]
  level: number
  content: string
}

/**
 * Memoized per CMS instance.
 *
 * Building the index parses every document, so it's the most expensive read in the
 * app. A `WeakMap` keyed by the instance gets invalidation for free: `getProdCMS`
 * drops and rebuilds the singleton when the head advances, and each preview SHA has
 * its own instance, so a stale index is unreachable by construction.
 */
const searchSectionsCache = new WeakMap<ComarkCMS, Promise<SearchSection[]>>()

/**
 * Drop the memoized index for an instance.
 *
 * Needed for the one case instance identity can't cover: in development the
 * default instance watches the working tree, so its content changes underneath a
 * stable object. `createSourceCMS` calls this from `watch:file:update`.
 */
export function invalidateSearchSections(cms: ComarkCMS): void {
  searchSectionsCache.delete(cms)
}

/**
 * Walk every document's AST and yield one section per heading.
 *
 * `UContentSearch` consumes this shape directly via its `files` prop.
 */
export function buildSearchSections(cms: ComarkCMS): Promise<SearchSection[]> {
  let sections = searchSectionsCache.get(cms)
  if (!sections) {
    sections = collectSearchSections(cms).catch((error) => {
      searchSectionsCache.delete(cms)
      throw error
    })
    searchSectionsCache.set(cms, sections)
  }
  return sections
}

async function collectSearchSections(cms: ComarkCMS): Promise<SearchSection[]> {
  const docs = await cms.list(['content'])
  const sections: SearchSection[] = []

  // Fetch (and parse) every document up front rather than awaiting one per
  // iteration — the section walk below is synchronous and order-dependent, so it
  // still runs in list order.
  const items = await Promise.all(docs.map((meta) => cms.get(meta.path)))

  for (const [index, meta] of docs.entries()) {
    const item = items[index]
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

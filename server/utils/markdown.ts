import type { DocsContent } from './content'
import { renderMarkdown } from 'comark/render'

export async function renderPageMarkdown(content: DocsContent, path: string): Promise<string | null> {
  const item = await content.get(path)
  if (!item || item.meta.kind !== 'document') return null

  return await renderMarkdown({ nodes: item.nodes, frontmatter: item.data })
}

/** Page path → raw markdown URL (`/` → `/raw/index.md`). */
export function rawUrlForPage(path: string): string {
  return path === '/' ? '/raw/index.md' : `/raw/${path.replace(/^\//, '')}.md`
}

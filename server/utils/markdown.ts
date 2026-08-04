import type { ComarkContent } from 'comark-content'
import { renderMarkdown } from 'comark/render'

/** Render a CMS document as plain markdown with a `# title` / `> description` lead. */
export async function renderPageMarkdown(cms: ComarkContent, path: string): Promise<string | null> {
  const item = await content.get(path)
  if (!item || item.meta.kind !== 'document') return null

  const fm = (item.data as any) ?? {}
  const lead = [fm.title ? `# ${fm.title}` : '', fm.description ? `> ${fm.description}` : '']
    .filter(Boolean)
    .join('\n\n')

  const body = await renderMarkdown({ nodes: item.nodes, frontmatter: item.data })
  return [lead, body].filter(Boolean).join('\n\n')
}

/** Page path → raw markdown URL (`/` → `/raw/index.md`). */
export function rawUrlForPage(path: string): string {
  return path === '/' ? '/raw/index.md' : `/raw/${path.replace(/^\//, '')}.md`
}

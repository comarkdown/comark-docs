import type { H3Event } from 'h3'
import { setHeader, setResponseStatus } from 'h3'

/**
 * A 404 with a short markdown body instead of the app shell or a JSON error: agents that land on a
 * missing page get pointers to the machine-readable indexes so they can recover instead of guessing.
 */
export function notFoundMarkdown(event: H3Event, path?: string): string {
  setResponseStatus(event, 404, 'Page not found')
  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setHeader(event, 'Vary', 'Accept')

  return [
    '# Page not found',
    '',
    path ? `\`${path}\` does not exist on this site.` : 'This page does not exist on this site.',
    '',
    'Where to look next:',
    '',
    '- [/llms.txt](/llms.txt) — index of every documentation page, with raw markdown links',
    '- [/llms-full.txt](/llms-full.txt) — the full documentation as a single markdown file',
    '- [/raw/index.md](/raw/index.md) — the landing page as markdown',
    '- [/sitemap.xml](/sitemap.xml) — sitemap of the rendered pages',
    '',
    'Every documentation page is mirrored as raw markdown at `/raw/<path>.md`.',
    '',
  ].join('\n')
}

/** `/raw/**` slug (`getting-started/installation.md`) → content path (`/getting-started/installation`). */
export function pagePathFromRawSlug(slug: string): string {
  const stripped = slug.replace(/\.md$/, '')
  return stripped === 'index' ? '/' : `/${stripped}`
}

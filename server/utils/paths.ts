/** Repo-relative content prefix (e.g. `docs/content/`), derived at build time by modules/config.ts. */
export function contentPrefix(): string {
  return `${useRuntimeConfig().docs.contentDir.replace(/\/$/, '')}/`
}

/** Whether a GitHub repo path is a content markdown file. */
export function isContentMd(path: string): boolean {
  return path.startsWith(contentPrefix()) && path.toLowerCase().endsWith('.md')
}

/** Whether a GitHub repo path is a navigation config file (`.navigation.yml` / `.json`). */
export function isNavConfig(path: string): boolean {
  return path.startsWith(contentPrefix()) && /\.navigation\.(?:ya?ml|json)$/i.test(path)
}

/**
 * Parse a content repo path into route segments (`1.getting-started/2.intro.md` →
 * `['getting-started', 'intro']`). `isIndex` covers both `index.md` and `index/index.md`.
 */
export function slugFromPath(path: string): { isIndex: boolean; segments: string[] } | null {
  const prefix = contentPrefix()
  if (!path.startsWith(prefix) || !path.toLowerCase().endsWith('.md')) return null

  const relative = path.slice(prefix.length, -3)
  const segments = relative.split('/').map((s) => s.replace(/^\d+\./, ''))
  const last = segments[segments.length - 1]
  const isIndex = last === 'index'
  if (isIndex) segments.pop()
  return { isIndex, segments }
}

/** Frontend page route (e.g. `1.getting-started/2.intro.md` → `/getting-started/intro`, root → `/`). */
export function pageUrlForPath(path: string): string | null {
  const result = slugFromPath(path)
  if (!result) return null
  const { isIndex, segments } = result
  if (isIndex && segments.length === 0) return '/'
  return `/${segments.join('/')}`
}

/** Raw markdown route — the only per-file route that stays cached, as `/api/pages` is served live. */
export function rawUrlForPath(path: string): string | null {
  const result = slugFromPath(path)
  if (!result) return null

  const { isIndex, segments } = result
  if (isIndex && segments.length === 0) return '/raw/index.md'
  return `/raw/${segments.join('/')}.md`
}

/** Nuxt payload route for a frontend page route */
export function payloadUrlForRoute(route: string, buildId?: string): string {
  const path = `${route === '/' ? '' : route}/_payload.json`
  return buildId ? `${path}?${buildId}` : path
}

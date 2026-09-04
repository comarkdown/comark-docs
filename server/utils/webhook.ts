import { DEFAULT_CONTENT_NAME, type ContentListFile } from 'comark-content'
import type { GitHubCommit } from './github'
import { hashManifestItem } from './json'

/** How a push changed the content source, already filtered to `contentDir`. */
export interface ContentChanges {
  /** Manifest keys (`default/<stem><ext>`) of files added or modified. */
  upserted: string[]
  /** Manifest keys of files removed — only the previous manifest can resolve their paths. */
  removed: string[]
  /** A `.navigation.*` file changed, so the tree changed regardless of which pages did. */
  navTouched: boolean
}

/** Files the content source can actually serve — matches the parsers installed in `content.ts`. */
const CONTENT_EXTENSIONS = ['.md', '.yml', '.yaml', '.json']

/** The content instance's name (see `createSourceContent()` in `content.ts`) — unnamed, so `default`. */
const SOURCE_NAME = DEFAULT_CONTENT_NAME

/**
 * A push's changed content files, named by their manifest key (`default/<stem><ext>`) — the
 * reverse of `meta.key`, so a diff against `manifest.items` doesn't need to re-derive file → URL
 * mappings that comark already owns.
 */
export function changesForPush(contentDir: string, commits: GitHubCommit[]): ContentChanges {
  const upserted = new Set<string>()
  const removed = new Set<string>()
  let navTouched = false

  const consider = (file: string, into: Set<string>) => {
    const key = manifestKeyFor(file, contentDir)
    if (!key) return

    if (isNavConfigFile(file)) navTouched = true
    else into.add(key)
  }

  for (const commit of commits) {
    for (const file of commit.added ?? []) consider(file, upserted)
    for (const file of commit.modified ?? []) consider(file, upserted)
    for (const file of commit.removed ?? []) consider(file, removed)
  }

  // A path removed and re-added in the same push is an upsert, not a removal.
  for (const key of upserted) removed.delete(key)

  return { upserted: [...upserted], removed: [...removed], navTouched }
}

/** Repo-relative path → its key in the manifest, or `null` when it can't be a content file. */
function manifestKeyFor(file: string, contentDir: string): string | null {
  const dir = contentDir.replace(/^\/+|\/+$/g, '')
  const prefix = dir ? `${dir}/` : ''

  if (prefix && !file.startsWith(prefix)) return null
  if (!CONTENT_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))) return null

  return `${SOURCE_NAME}/${file.slice(prefix.length)}`
}

/** Directory configuration (`.navigation.yml`), which contributes to the tree rather than a page. */
function isNavConfigFile(file: string): boolean {
  return /\.navigation\.(?:ya?ml|json)$/i.test(file)
}

/**
 * The payload URL a client-side navigation fetches for `path`
 */
export function payloadUrlForPage(path: string, buildId?: string): string {
  const base = path === '/' ? '/_payload.json' : `${path.replace(/\/$/, '')}/_payload.json`
  return buildId ? `${base}?_b=${buildId}` : base
}

/** `default/<stem><ext>` (a manifest key) → page path, the reverse of what the path-keyed manifest gives. */
export function indexByFileKey(items: Record<string, ContentListFile>): Map<string, string> {
  const index = new Map<string, string>()
  for (const item of Object.values(items)) index.set(item.meta.key, item.path)
  return index
}

/**
 * Which pages a push changed, and whether the tree itself moved.
 */
export function diffContent(
  changes: ContentChanges,
  before: Record<string, ContentListFile>,
  after: Record<string, ContentListFile>
): { pagePaths: string[]; navChanged: boolean } {
  const pagePaths = new Set<string>()

  const afterByKey = indexByFileKey(after)
  const beforeByKey = indexByFileKey(before)

  for (const key of changes.upserted) {
    const path = afterByKey.get(key)
    if (path) pagePaths.add(path)
  }
  for (const key of changes.removed) {
    const path = beforeByKey.get(key)
    if (path) pagePaths.add(path)
  }

  const beforeKeys = Object.keys(before)
  const afterKeys = Object.keys(after)
  const navChanged =
    beforeKeys.length !== afterKeys.length ||
    afterKeys.some((key) => !before[key]) ||
    // Listing fields (title, description, icon, `navigation`…) are what the tree renders from.
    afterKeys.some((key) => before[key] && !sameListing(before[key]!, after[key]!))

  return { pagePaths: [...pagePaths], navChanged }
}

function sameListing(a: ContentListFile, b: ContentListFile): boolean {
  return a.path === b.path && hashManifestItem(a) === hashManifestItem(b)
}

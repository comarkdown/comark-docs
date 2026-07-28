import { join, normalize, relative } from 'pathe'

export interface ContentDirInput {
  /** The consuming app's root directory. */
  rootDir: string
  /** Git repository root containing `rootDir`, if one could be found. */
  gitRoot?: string
  /** `comarkDocs.contentDir`, or `NUXT_DOCS_CONTENT_DIR`. */
  explicit?: string
}

export interface ContentDirResult {
  /** Absolute path to the content directory (the dev filesystem source). */
  contentPath: string
  /** Content directory relative to the repository root (GitHub source, edit links, webhook). */
  contentDir: string
  /** Where the value came from. */
  source: 'explicit' | 'git' | 'assumed'
}

/**
 * Locate the content directory, both absolutely and relative to the repo root.
 *
 * The relative form is the load-bearing one: it's the path the GitHub source reads
 * from, the path in "Edit this page" links, and the prefix the push webhook uses to
 * decide whether a changed file is content. Every one of those is wrong — and wrong
 * silently, since dev reads the absolute path and never notices — if the repo root
 * can't be located.
 *
 * Resolution order, most to least authoritative:
 *
 * 1. `explicit` — the consumer said so.
 * 2. `gitRoot` — derived by relativising against the repository root.
 * 3. Neither: assume the app *is* the repository root. Correct for a single-app
 *    repo, wrong for an app in a subdirectory (`docs/`, `apps/docs/`), and there is
 *    no way to tell which from the filesystem alone. Reported as `assumed` so the
 *    caller can say so out loud.
 */
export function resolveContentDir({ rootDir, gitRoot, explicit }: ContentDirInput): ContentDirResult {
  const contentPath = join(rootDir, 'content')

  if (explicit) {
    return { contentPath, contentDir: normalize(explicit).replace(/^\/+|\/+$/g, ''), source: 'explicit' }
  }

  if (gitRoot) {
    return { contentPath, contentDir: relative(gitRoot, contentPath) || 'content', source: 'git' }
  }

  return { contentPath, contentDir: 'content', source: 'assumed' }
}

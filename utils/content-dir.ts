import { join, normalize, relative } from 'pathe'

export interface ContentDirInput {
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
  source: 'explicit' | 'git' | 'assumed'
}

/**
 * Locate the content directory, both absolutely and relative to the repo root.
 *
 * The relative form is load-bearing: the GitHub source path, "Edit this page" links and the webhook's content
 * prefix all derive from it, and all three break silently (dev reads the absolute path) if the repo root can't
 * be found. Order: `explicit`, `gitRoot`, else assume the app *is* the repo root — right for a single-app repo,
 * wrong for `docs/`, undetectable from the filesystem, hence the `'assumed'` source for the caller to warn on.
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

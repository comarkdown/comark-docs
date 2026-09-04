import { getLastCommit, getTreeSha, hasParent, headCommit } from '../../utils/git'
import { fetchLastContentCommit } from '../../utils/github'

export interface SeedRefsInput {
  /** Repository root of the checkout being built. */
  repoRoot: string
  /** Content directory, relative to the repository root. */
  contentDir: string
  /** `owner/name` of the content repository. */
  repo: string
  /** GitHub token, if the build has one. Without it only the git fallback runs. */
  token?: string
  /** Global Config pin, if one is set — production serves it in preference to the branch head. */
  pinnedSha?: string
  /** Reported to the caller; defaults to `console.warn`. */
  warn?: (message: string) => void
}

/** {@link fetchLastContentCommit}, but never throwing: a build-time optimization must not fail a build. */
async function lastContentCommit(
  repo: string,
  contentDir: string,
  ref: string,
  token?: string
): Promise<string | undefined> {
  try {
    const sha = await fetchLastContentCommit({ repo, path: contentDir, ref, token })
    // Validated here rather than in the shared query: this one names a directory in the build.
    return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : undefined
  } catch {
    return undefined
  }
}

/**
 * The refs a build-time content seed may be stored under: commits whose `contentDir` holds exactly
 * the content being parsed.
 *
 * Aligned with `resolveContentSha()` runs at runtime.
 */
export async function resolveSeedRefs(input: SeedRefsInput): Promise<string[]> {
  const { repoRoot, contentDir, repo, token, pinnedSha } = input
  const warn = input.warn ?? ((message: string) => console.warn(message))

  const head = headCommit(repoRoot)
  const refs = new Set<string>()

  const fromApi = head && repo ? await lastContentCommit(repo, contentDir, head, token) : undefined
  if (fromApi) {
    refs.add(fromApi)

    // The pin earns a label only if its content is the same tree — same question, asked of the pin's
    // own history. A pin on older content resolves elsewhere and is dropped.
    if (pinnedSha && pinnedSha !== fromApi) {
      const fromPin = await lastContentCommit(repo, contentDir, pinnedSha, token)
      if (fromPin === fromApi) refs.add(pinnedSha)
    }
    return [...refs]
  }

  // No API answer: fall back to git, which needs the tree check to be trustworthy.
  const parsed = getTreeSha(repoRoot, 'HEAD', contentDir)
  const fromGit = getLastCommit(repoRoot, contentDir)
  if (!parsed || !fromGit) return []

  if (getTreeSha(repoRoot, fromGit, contentDir) !== parsed) return []

  if (!hasParent(repoRoot, fromGit)) {
    warn(
      `Could not reach the GitHub API, and git labels the content seed ${fromGit.slice(0, 7)}, ` +
        `which has no parent in this checkout — a shallow clone boundary.\n` +
        `  The seed is safe, but probably will not be looked up under that commit at runtime.`
    )
  }

  refs.add(fromGit)
  if (pinnedSha && getTreeSha(repoRoot, pinnedSha, contentDir) === parsed) refs.add(pinnedSha)
  return [...refs]
}

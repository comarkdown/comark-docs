import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Source } from 'comark-content'
import type { PageCommit } from './github'

const exec = promisify(execFile)
/** Root of the git repository holding the content (resolved at build time by modules/config/). */
function repoRoot(): string {
  return useRuntimeConfig().docs.repoRoot
}
const MAX_BUFFER = 64 * 1024 * 1024

/**
 * Resolve a preview ref to a commit without a local checkout: in dev `/tree/:branch` usually names a
 * branch that exists only on origin, where bare `git show <branch>:file` fails. The final bare-ref
 * candidate is what makes a `/blob/:sha` commit SHA work.
 *
 * `--end-of-options` is load-bearing — a ref beginning with `-` would otherwise parse as an option,
 * and `git show` accepts diff options including `--output=<file>`. Don't swap it for `--`:
 * `<rev>:<path>` is an object spec, so `git show -- HEAD:file` reads it as a pathspec, emitting nothing.
 */
async function resolveGitRef(ref: string): Promise<string> {
  const candidates = [`refs/heads/${ref}`, `refs/remotes/origin/${ref}`, ref]

  for (const candidate of candidates) {
    try {
      const { stdout } = await exec(
        'git',
        ['rev-parse', '--verify', '--quiet', '--end-of-options', `${candidate}^{commit}`],
        { cwd: repoRoot(), maxBuffer: MAX_BUFFER }
      )
      const sha = stdout.trim()
      if (sha) return sha
    } catch {
      // Try the next ref form.
    }
  }

  throw createError({ statusCode: 404, statusMessage: `Git ref not found locally or on origin: ${ref}` })
}

// `ref` comes from a URL: `parseRef` validates it at the route boundary, re-checked here before argv.
/** A comark Source reading content from the local git repo at a ref. */
export function gitLocalSource(ref: string, dir: string): Source {
  if (!parseRef(ref)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid git ref: ${ref}` })
  }
  const prefix = `${dir.replace(/\/$/, '')}/`

  const show = async (key: string) => {
    const resolved = await resolveGitRef(ref)
    const { stdout } = await exec('git', ['show', '--end-of-options', `${resolved}:${prefix}${key}`], {
      cwd: repoRoot(),
      maxBuffer: MAX_BUFFER,
    })
    return stdout
  }

  return {
    keys: async () => {
      const resolved = await resolveGitRef(ref)
      const { stdout } = await exec(
        'git',
        ['ls-tree', '-r', '-z', '--name-only', '--end-of-options', resolved, '--', dir],
        {
          cwd: repoRoot(),
          maxBuffer: MAX_BUFFER,
        }
      )
      return stdout
        .split('\0')
        .filter(Boolean)
        .filter((p) => p.startsWith(prefix))
        .map((p) => p.slice(prefix.length))
    },
    getItem: (key: string) => show(key),
    getItemRaw: (key: string) => show(key),
  }
}

/** The commits that touched a repo file, newest first (local equivalent of the GitHub commits API). */
export async function gitLocalFileHistory(repoPath: string, limit = 5): Promise<PageCommit[]> {
  try {
    const { stdout } = await exec('git', ['log', `-n${limit}`, '--format=%H%x1f%an%x1f%aI%x1f%s', '--', repoPath], {
      cwd: repoRoot(),
      maxBuffer: MAX_BUFFER,
    })
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha = '', author, date, message = ''] = line.split('\x1F')
        return { sha, shortSha: sha.slice(0, 7), message, author, date }
      })
  } catch (error) {
    console.error(`[history] git log failed for ${repoPath}`, error)
    return []
  }
}

/** The current HEAD commit (the local stand-in for the production deploy commit). */
export async function gitLocalHeadCommit(): Promise<PageCommit | null> {
  try {
    const { stdout } = await exec('git', ['log', '-1', '--format=%H%x1f%an%x1f%aI%x1f%s', 'HEAD'], {
      cwd: repoRoot(),
      maxBuffer: MAX_BUFFER,
    })
    const [sha = '', author, date, message = ''] = stdout.trim().split('\x1F')
    return sha ? { sha, shortSha: sha.slice(0, 7), message, author, date } : null
  } catch (error) {
    console.error('[history] git HEAD lookup failed', error)
    return null
  }
}

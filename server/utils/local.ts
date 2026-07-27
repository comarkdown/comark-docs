import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Source } from '@comark/cms'
import type { PageCommit } from './github'

/**
 * Local git helpers
 */

const exec = promisify(execFile)
/** Root of the git repository holding the content (resolved at build time by modules/config.ts). */
function repoRoot(): string {
  return useRuntimeConfig().docs.repoRoot
}
const MAX_BUFFER = 64 * 1024 * 1024

/** A comark Source reading content from the local git repo at a ref. */
export function gitLocalSource(ref: string, dir: string): Source {
  const prefix = `${dir.replace(/\/$/, '')}/`

  const show = async (key: string) => {
    const { stdout } = await exec('git', ['show', `${ref}:${prefix}${key}`], {
      cwd: repoRoot(),
      maxBuffer: MAX_BUFFER,
    })
    return stdout
  }

  return {
    keys: async () => {
      const { stdout } = await exec('git', ['ls-tree', '-r', '-z', '--name-only', ref, dir], {
        cwd: repoRoot(),
        maxBuffer: MAX_BUFFER,
      })
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
        const [sha = '', author, date, message = ''] = line.split('\x1f')
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
    const [sha = '', author, date, message = ''] = stdout.trim().split('\x1f')
    return sha ? { sha, shortSha: sha.slice(0, 7), message, author, date } : null
  } catch (error) {
    console.error('[history] git HEAD lookup failed', error)
    return null
  }
}

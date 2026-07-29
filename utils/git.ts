import { execSync } from 'node:child_process'

export interface GitInfo {
  name: string
  owner: string
  url: string
}

function git(command: string, cwd: string): string | undefined {
  try {
    return execSync(`git ${command}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return undefined
  }
}

/** The branch this checkout/deployment tracks (CI env first, local git as fallback). */
export function getGitBranch(cwd: string): string {
  const envName =
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.CF_PAGES_BRANCH ||
    process.env.CI_COMMIT_BRANCH ||
    process.env.BRANCH ||
    process.env.GITHUB_REF_NAME

  if (envName && envName !== 'HEAD') return envName

  const branch = git('rev-parse --abbrev-ref HEAD', cwd)
  return branch && branch !== 'HEAD' ? branch : 'main'
}

/** Absolute path of the git repository root containing `cwd`, if any. */
export function getGitRoot(cwd: string): string | undefined {
  return git('rev-parse --show-toplevel', cwd)
}

/**
 * Owner/name/url from a git remote URL, in both forms `git remote get-url` emits (`git@host:owner/name.git`,
 * `https://host/owner/name(.git)`). Split out from `getLocalGitInfo` so the regex is testable without a
 * checkout — every inferred default in `modules/config.ts` (site name, edit links, webhook repo) flows from it.
 */
export function parseGitRemote(remote: string): GitInfo | undefined {
  const match = remote.trim().match(/^(?:git@|https?:\/\/)([^/:]+)[/:]([^/]+)\/(.+?)(?:\.git)?$/)
  if (!match) return undefined

  const [, host, owner, name] = match
  return { name: name!, owner: owner!, url: `https://${host}/${owner}/${name}` }
}

/** Owner/name/url parsed from the `origin` remote of the local checkout. */
export function getLocalGitInfo(cwd: string): GitInfo | undefined {
  const remote = git('remote get-url origin', cwd)
  return remote ? parseGitRemote(remote) : undefined
}

/** Owner/name/url from CI provider env vars (Vercel, GitHub Actions, GitLab). */
export function getGitEnv(): GitInfo | undefined {
  const provider =
    process.env.VERCEL_GIT_PROVIDER || (process.env.GITHUB_SERVER_URL ? 'github' : undefined) || ''
  const owner =
    process.env.VERCEL_GIT_REPO_OWNER ||
    process.env.GITHUB_REPOSITORY_OWNER ||
    process.env.CI_PROJECT_PATH?.split('/').shift() ||
    ''
  const name =
    process.env.VERCEL_GIT_REPO_SLUG ||
    process.env.GITHUB_REPOSITORY?.split('/').pop() ||
    process.env.CI_PROJECT_PATH?.split('/').slice(1).join('/') ||
    ''

  if (!owner || !name) return undefined

  return { name, owner, url: `https://${provider || 'github'}.com/${owner}/${name}` }
}

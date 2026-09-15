/** Flag the newest commit — the version this page currently renders. */
export function withCurrentVersion(commits: PageCommit[]): PageCommit[] {
  if (!commits.length) return commits
  return [{ ...commits[0]!, current: true }, ...commits.slice(1)]
}

/**
 * Flag commits absent from the default branch's history for the same path.
 */
export function withBranchOnly(commits: PageCommit[], defaultShas: Set<string>): PageCommit[] {
  return commits.map((commit) => (defaultShas.has(commit.sha) ? commit : { ...commit, branchOnly: true }))
}

/**
 * Flag the newest commit that touched this page on the default branch.
 * No-ops when `sha` isn't in `commits` — a stale branch whose history doesn't reach that far back.
 */
export function withMainLatest(commits: PageCommit[], sha: string | undefined): PageCommit[] {
  if (!sha) return commits
  return commits.map((commit) => (commit.sha === sha ? { ...commit, mainLatest: true } : commit))
}

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

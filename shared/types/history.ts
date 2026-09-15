/** A single commit in a page's version history — from the GitHub API or, in dev, local `git log`. */
export interface PageCommit {
  sha: string
  shortSha: string
  message: string
  author?: string
  avatarUrl?: string
  date?: string
  /** The version this page currently renders. */
  current?: boolean
  /** On the previewed branch but not (yet) on the default branch. */
  branchOnly?: boolean
  /** Newest commit that touched this page on the default branch — rendered only when not `current`. */
  mainLatest?: boolean
}

/** Response of `/api/history`: a page's commit history plus which branch is deployed. */
export interface PageHistory {
  /** The branch this deployment serves (`targetBranch()`). */
  branch: string
  /** The repo's default branch, resolved from GitHub — differs from `branch` off a fork/rename. */
  defaultBranch?: string
  commits: PageCommit[]
}

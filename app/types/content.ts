import type { ContentClient } from 'comark-content/client'

/** Which serving mode the active route is in. */
export type ContentMode = 'prod' | 'tree' | 'blob' | 'pr'

export interface ActiveContent {
  mode: ContentMode
  /** The branch name (tree), commit SHA (blob) or PR number (pr); `undefined` in prod. */
  ref?: string
  /** Vue Router prefix for this version (`/tree/<branch>`, `/blob/<sha>`, `/pr/<number>`, or `''` in prod). */
  routeBase: string
  /** This mode's `content.handler()` prefix (one `/api/content` namespace below the routeBase) */
  apiBase: string
  /** The path within the content source (with leading slash). */
  path: string
  client: ContentClient<string>
}

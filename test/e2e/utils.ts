import { inject } from 'vitest'

export const baseURL = inject('baseURL')

/**
 * The playground's `site.url`, which absolute URLs (sitemap, canonical, OG) point at.
 * Keep in sync with `playground/nuxt.config.ts`.
 */
export const SITE_URL = 'https://docs-template.comark.dev'

/** A playground page the tests read, renamed together with its content file. */
export const INTRO_PAGE = { path: '/getting-started/introduction', title: 'Introduction' } as const

/** A slug no page uses. */
export const NOT_FOUND_SLUG = '__e2e-not-found__'

// Only set against a protected Vercel deployment, see `test/smoke/`.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

/** Requests a site path, passing Vercel's Deployment Protection when a bypass secret is set. */
export function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (bypassSecret) headers.set('x-vercel-protection-bypass', bypassSecret)
  return fetch(new URL(path, baseURL), { ...init, headers })
}

/** Fetches a site path once: use it for expected errors, which the server logs on every request. */
export function fetchPath(path: string, headers?: HeadersInit): Promise<Response> {
  return request(path, { headers })
}

/** Fetches a site path, explaining a failure with the message Nitro attaches to its JSON errors. */
export async function fetchWithFailure(path: string, headers?: HeadersInit) {
  const response = await fetchPath(path, headers)
  let failure = `${path} returned ${response.status}`
  if (response.status >= 400) {
    const error = await fetchPath(path, { accept: 'application/json' })
      .then((res) => res.json() as Promise<{ message?: string }>)
      .catch(() => undefined)
    if (error?.message) failure += `: ${error.message}`
  }
  return { response, failure }
}

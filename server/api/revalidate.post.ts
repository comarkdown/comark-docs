import { verify } from '@octokit/webhooks-methods'
import { DEFAULT_CONTENT_NAME } from 'comark-content'
import { waitUntil } from '@vercel/functions'

/** Each re-render hits this same deployment, so the ceiling is about not stampeding ourselves. */
const REVALIDATE_CONCURRENCY = 8

/** Why a route was purged — one value per `addPath` call site below. */
type PurgeReason = 'page' | 'payload' | 'raw' | 'nav' | 'artifact' | 'global'

/** Display/response order. */
const REASON_ORDER: PurgeReason[] = ['page', 'payload', 'raw', 'nav', 'artifact', 'global']

/** `nav` is the only unbounded reason (the whole site can be thousands of pages) — cap what the log prints. */
const MAX_LOGGED_PATHS_PER_REASON = 5

export default defineEventHandler(async (event) => {
  const { docs } = useRuntimeConfig(event)
  const secret = docs.webhookSecret || process.env.WEBHOOK_SECRET
  const bypassToken = docs.bypassToken || process.env.VERCEL_BYPASS_TOKEN
  if (!secret || !bypassToken) {
    throw createError({ statusCode: 501, statusMessage: 'Revalidation webhook is not configured' })
  }

  const signature = getHeader(event, 'x-hub-signature-256')
  if (!signature) {
    throw createError({ statusCode: 401, statusMessage: 'Missing signature' })
  }

  const raw = await readRawBody(event, 'utf8')
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: 'Empty body' })
  }

  if (!(await verify(secret, raw, signature))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid signature' })
  }

  const requestId = getHeader(event, 'x-vercel-id') ?? getHeader(event, 'x-request-id') ?? 'local'
  const deliveryId = getHeader(event, 'x-github-delivery')
  const tag = `[revalidate:${requestId}${deliveryId ? `:${deliveryId}` : ''}]`
  const timings = createTimings()

  const githubEvent = getHeader(event, 'x-github-event')
  if (githubEvent !== 'push') {
    console.log(`${tag} skipped: ${githubEvent ?? 'unknown'} event`)
    return { ok: true, skipped: 'not-a-push-event', event: githubEvent }
  }

  const payload = JSON.parse(raw) as GitHubPushPayload
  const branch = targetBranch()
  const contentDir = docs.contentDir
  const expectedRef = `refs/heads/${branch}`

  const repo = githubRepo()
  if (payload.repository?.full_name && payload.repository.full_name !== repo) {
    console.log(`${tag} skipped: repo=${payload.repository.full_name} !== expected=${repo}`)
    return { ok: true, skipped: 'wrong-repo', expected: repo, received: payload.repository.full_name }
  }

  if (payload.ref !== expectedRef) {
    console.log(`${tag} skipped: ref=${payload.ref} !== expected=${expectedRef}`)
    return { ok: true, skipped: 'non-target-branch', expected: expectedRef, received: payload.ref }
  }

  const changes = changesForPush(contentDir, payload.commits ?? [])
  if (!changes.upserted.length && !changes.removed.length && !changes.navTouched) {
    return { ok: true, skipped: 'no-content-changes' }
  }

  const buildId = useRuntimeConfig(event).app.buildId
  const pathsToPurge = new Set<string>()
  const byReason = new Map<PurgeReason, Set<string>>()

  /** Add a path to the purge set, and track it by reason for the breakdown log. */
  const addPath = (reason: PurgeReason, path: string): void => {
    if (pathsToPurge.has(path)) return
    pathsToPurge.add(path)
    const paths = byReason.get(reason) ?? new Set<string>()
    paths.add(path)
    byReason.set(reason, paths)
  }

  // Diffed against the live prod instance, already warm
  const { headSha, freshContent, newItems, pagePaths, navChanged } = await timings.time('rebuild', async () => {
    const outdated = await getProdContent()
    await outdated.init()
    const oldItems = { ...(await outdated.manifest()).items }

    // Refresh the content SHA
    const headSha = await resolveContentSha(branch, contentDir, { refresh: true })
    const freshContent = await createSourceContent(headSha, { cache: { driver: cacheDriver(headSha) } })
    await freshContent.init()
    const newItems = (await freshContent.manifest()).items

    return { headSha, freshContent, newItems, ...diffContent(changes, oldItems, newItems) }
  })

  for (const path of pagePaths) {
    addPath('page', path)
    addPath('payload', payloadUrlForPage(path, buildId))
    addPath('raw', rawUrlForPage(path))
  }

  // Navigation renders on every page, so a change to it re-renders all of them.
  if (navChanged) {
    for (const item of Object.values(newItems)) {
      if (item.meta.kind !== 'document') continue
      addPath('nav', item.path)
      addPath('nav', payloadUrlForPage(item.path, buildId))
      addPath('nav', rawUrlForPage(item.path))
    }
  }

  // Per-commit search artifacts (ISR, immutable).
  const artifactBase = `/api/content/blob/${headSha}`
  const manifestPath = `${artifactBase}/manifest.json`
  const snapshotPath = `${artifactBase}/snapshot/${DEFAULT_CONTENT_NAME}.json`
  addPath('artifact', manifestPath)
  addPath('artifact', snapshotPath)
  const artifactPaths = new Set([manifestPath, snapshotPath])

  // Any content change invalidates the global indexes: each is rebuilt from the whole tree.
  for (const path of ['/llms.txt', '/llms-full.txt', '/rss.xml', '/sitemap.xml']) {
    addPath('global', path)
  }

  console.log(
    `${tag} navChanged=${navChanged} ` +
      `(upserted=${changes.upserted.length}, removed=${changes.removed.length}, navConfig=${changes.navTouched}) | ` +
      `${pathsToPurge.size} route(s) | ${timings.format()}`
  )

  logBreakdown(tag, byReason)

  // Dev has no ISR cache to purge
  if (import.meta.dev) {
    return { ok: true, requestId, deliveryId, navChanged, routes: routesBreakdown(byReason), dev: true }
  }

  const protocol = getRequestProtocol(event)
  const host = getRequestHost(event, { xForwardedHost: true })
  const baseURL = `${protocol}://${host}`

  // `x-prerender-revalidate` purges the ISR cache entry for the URL being fetched.
  const headers: Record<string, string> = { 'x-prerender-revalidate': bypassToken }
  // Lets the deployment call itself while Vercel Authentication is on (preview deploys).
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  }

  // Vercel's native waitUntil, not Nitro's `event.waitUntil` — that one can orphan async work here.
  waitUntil(
    (async () => {
      const absent: string[] = []

      // Warms the per-SHA body cache and persists the snapshot artifact the fetches below read.
      await timings.time('warm', () =>
        warmArtifacts(freshContent).catch((error) => {
          console.error(`${tag} artifact warm failed`, error?.message ?? error)
        })
      )

      const revalidate = (path: string) =>
        $fetch(path, { baseURL, method: 'GET', headers }).catch((error) => {
          console.error(`${tag}   ✗ ${path}`, error?.statusCode ?? error?.message ?? error)
          throw error
        })

      const artifactResults = await timings.time('artifact', () =>
        settleInBatches([...artifactPaths], REVALIDATE_CONCURRENCY, revalidate)
      )

      const pagePathsToPurge = [...pathsToPurge].filter((path) => !artifactPaths.has(path))
      const pageResults = await timings.time('purge', () =>
        settleInBatches(pagePathsToPurge, REVALIDATE_CONCURRENCY, (path) =>
          $fetch(path, { baseURL, method: 'GET', headers }).catch((error) => {
            // Content with no page of its own (e.g. a partial) has nothing cached to purge.
            if (error?.statusCode === 404) {
              absent.push(path)
              return
            }
            console.error(`${tag}   ✗ ${path}`, error?.statusCode ?? error?.message ?? error)
            throw error
          })
        )
      )

      const results = [...artifactResults, ...pageResults]
      const failed = results.filter((r) => r.status === 'rejected').length
      console.log(
        `${tag} complete: ${results.length - failed - absent.length} purged, ${absent.length} absent, ` +
          `${failed} failed | ${timings.format()} | total=${timings.since()}ms`
      )
      logAbsent(tag, absent)
    })()
  )

  return {
    ok: true,
    requestId,
    deliveryId,
    navChanged,
    manifest: { upserted: changes.upserted, removed: changes.removed },
    routes: routesBreakdown(byReason),
  }
})

/** One log line per purged path, grouped by reason. */
function logBreakdown(tag: string, byReason: Map<PurgeReason, Set<string>>): void {
  for (const reason of REASON_ORDER) {
    const paths = byReason.get(reason)
    if (!paths?.size) continue

    const sorted = [...paths].sort()
    for (const path of sorted.slice(0, MAX_LOGGED_PATHS_PER_REASON)) {
      console.log(`${tag}   ${reason}\t${path}`)
    }
    if (sorted.length > MAX_LOGGED_PATHS_PER_REASON) {
      console.log(`${tag}   ${reason}\t... (${sorted.length} total)`)
    }
  }
}

/** One log line per absent path — expected to be empty. */
function logAbsent(tag: string, absent: string[]): void {
  for (const path of [...absent].sort()) {
    console.log(`${tag}   absent\t${path}`)
  }
}

/** Route counts by reason. */
function routesBreakdown(byReason: Map<PurgeReason, Set<string>>): { total: number } & Partial<Record<PurgeReason, number>> {
  const counts: Partial<Record<PurgeReason, number>> = {}
  for (const [reason, paths] of byReason) counts[reason] = paths.size

  const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0)
  return { total, ...counts }
}

/** `Promise.allSettled` over `items`, at most `size` in flight. */
async function settleInBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<unknown>
): Promise<PromiseSettledResult<unknown>[]> {
  const results: PromiseSettledResult<unknown>[] = []
  for (let i = 0; i < items.length; i += size) {
    // Not `.map(fn)` — `map` passes the index, which lands in the callee's optional parameter.
    results.push(...(await Promise.allSettled(items.slice(i, i + size).map((item) => fn(item)))))
  }
  return results
}

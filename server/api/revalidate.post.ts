import type { CMSListFile } from '@comark/cms'
import { verify } from '@octokit/webhooks-methods'
import { waitUntil } from '@vercel/functions'

/**
 * Simultaneous re-render requests during the purge fan-out. Each one is a full
 * page render on this same deployment, so the ceiling is about not stampeding
 * ourselves; the fan-out runs in `waitUntil`, so taking longer is free.
 */
const REVALIDATE_CONCURRENCY = 8

/** `Promise.allSettled` over `items`, at most `size` in flight. */
async function settleInBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<unknown>
): Promise<PromiseSettledResult<unknown>[]> {
  const results: PromiseSettledResult<unknown>[] = []
  for (let i = 0; i < items.length; i += size) {
    // `.map((item) => fn(item))`, not `.map(fn)` — `map` passes the index as a
    // second argument, which would land in the callee's optional parameter.
    results.push(...(await Promise.allSettled(items.slice(i, i + size).map((item) => fn(item)))))
  }
  return results
}

export default defineEventHandler(async (event) => {
  const { docs } = useRuntimeConfig(event)
  const secret = docs.webhookSecret || process.env.WEBHOOK_SECRET
  const bypassToken = docs.bypassToken || process.env.VERCEL_BYPASS_TOKEN
  if (!secret || !bypassToken) {
    throw createError({ statusCode: 500, statusMessage: 'Webhook not configured' })
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

  const payload = JSON.parse(raw) as GitHubPushPayload
  const branch = targetBranch()
  const expectedRef = `refs/heads/${branch}`

  if (payload.ref !== expectedRef) {
    console.log(`[cms] revalidate push skipped (ref=${payload.ref} !== expected=${expectedRef})`)
    return {
      ok: true,
      skipped: 'non-target-branch',
      expected: expectedRef,
      received: payload.ref,
    }
  }

  // Classify changed content files. A file added in one commit and modified in
  // another counts as added; `.navigation.*` config files always touch navigation.
  const added = new Set<string>()
  const removed = new Set<string>()
  const modified = new Set<string>()
  let navConfigTouched = false
  for (const commit of payload.commits ?? []) {
    for (const f of commit.added ?? []) {
      if (isContentMd(f)) added.add(f)
      else if (isNavConfig(f)) navConfigTouched = true
    }
    for (const f of commit.modified ?? []) {
      if (isContentMd(f)) modified.add(f)
      else if (isNavConfig(f)) navConfigTouched = true
    }
    for (const f of commit.removed ?? []) {
      if (isContentMd(f)) removed.add(f)
      else if (isNavConfig(f)) navConfigTouched = true
    }
  }
  for (const f of added) modified.delete(f)

  const changedFiles = [...added, ...modified, ...removed]
  if (changedFiles.length === 0 && !navConfigTouched) {
    return { ok: true, skipped: 'no-content-changes' }
  }

  const protocol = getRequestProtocol(event)
  const host = getRequestHost(event, { xForwardedHost: true })
  const baseURL = `${protocol}://${host}`

  // `x-vercel-protection-bypass` bypasses the SSO wall when the handler calls itself
  const readHeaders: Record<string, string> = {}
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    readHeaders['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  }

  // `x-prerender-revalidate` purges the ISR cache
  const headers: Record<string, string> = {
    ...readHeaders,
    'x-prerender-revalidate': bypassToken,
  }

  const headSha = payload.head_commit?.id
  if (!headSha) {
    throw createError({ statusCode: 400, statusMessage: 'Missing head commit SHA' })
  }

  // Write straight into the shared ref cache every `getProdCMS()` call reads
  // (see `resolveSha`/`cacheSha` in `server/utils/github.ts`), ahead of the
  // purge fan-out below — this is what keeps a freshly-purged page from
  // re-rendering against a stale SHA right after this push.
  await cacheSha(branch, headSha)

  console.log(`[cms] revalidate push headSha=${headSha ?? '<none>'}`)

  const requestId = getHeader(event, 'x-vercel-id') ?? getHeader(event, 'x-request-id') ?? 'local'
  const tag = `[revalidate:${requestId}]`

  // Plan synchronously so diagnostics are logged on this request and returned in
  // the webhook body. This costs two `init()` passes before we respond, against
  // GitHub's ~10s delivery timeout — acceptable because everything here is
  // idempotent (`cacheSha` is already written, the fan-out below re-renders), so a
  // timed-out delivery that GitHub retries only repeats work, it can't corrupt
  // state. If the content repo ever grows enough to make that routine, move the
  // before-manifest read into `waitUntil` and drop it from the response body.
  const beforeSha = payload.before
  let oldItems: Record<string, CMSListFile> = {}
  if (beforeSha && !/^0+$/.test(beforeSha)) {
    try {
      const oldCms = await createSourceCMS(beforeSha)
      await oldCms.init()
      oldItems = oldCms.manifest.items
    } catch (err: any) {
      console.warn(`${tag} no before-manifest (${beforeSha}) — treating as full revalidate:`, err?.message ?? err)
    }
  }

  const headCms = await createSourceCMS(headSha, { cache: { driver: cacheDriver(headSha) } })
  await headCms.init()
  const newItems = headCms.manifest.items

  const oldPaths = new Set(Object.keys(oldItems))
  const newPaths = Object.keys(newItems)
  const addedPaths = newPaths.filter((p) => !oldPaths.has(p))
  const removedPaths = [...oldPaths].filter((p) => !(p in newItems))

  const metaChangedPaths: string[] = []
  for (const p of newPaths) {
    if (oldPaths.has(p) && hashManifestItem(oldItems[p]) !== hashManifestItem(newItems[p])) metaChangedPaths.push(p)
  }
  const navChanged = navConfigTouched || addedPaths.length > 0 || removedPaths.length > 0 || metaChangedPaths.length > 0

  // Payload routes are keyed by the build-id query on some deployments, so we
  // revalidate the exact URL the browser loads (`…/_payload.json?<buildId>`).
  const buildId = useRuntimeConfig(event).app.buildId

  // For each page we add both the HTML route and its `_payload.json` hydration payload.
  // Any content change invalidates the ISR-cached llms indexes, the RSS feed, and the
  // search index (derived from every doc's body, same as the llms indexes).
  const paths = new Set<string>(['/llms.txt', '/llms-full.txt', '/rss.xml', '/api/cms/search-sections'])
  for (const f of changedFiles) {
    const pageUrl = pageUrlForPath(f)
    if (pageUrl) {
      paths.add(payloadUrlForRoute(pageUrl, buildId))
      paths.add(pageUrl)
    }
    const rawUrl = rawUrlForPath(f)
    if (rawUrl) paths.add(rawUrl)
  }

  // On a meta change or an added/removed file, navigation is updated
  // So we re-render every page and its hydration payload.
  if (navChanged) {
    for (const item of Object.values(newItems)) {
      if (item.meta.kind === 'document') {
        paths.add(item.path)
        paths.add(payloadUrlForRoute(item.path, buildId))
      }
    }
  }

  console.log(
    `${tag} navChanged=${navChanged} ` +
      `(added=${addedPaths.length}, removed=${removedPaths.length}, meta=${metaChangedPaths.length}, navConfig=${navConfigTouched}) | ` +
      `files: +${added.size} ~${modified.size} -${removed.size} | ${paths.size} route(s)`
  )
  if (metaChangedPaths.length) console.log(`${tag} meta changed: ${metaChangedPaths.join(', ')}`)
  if (addedPaths.length) console.log(`${tag} added: ${addedPaths.join(', ')}`)
  if (removedPaths.length) console.log(`${tag} removed: ${removedPaths.join(', ')}`)

  // Fan-out revalidation after the response. Use Vercel's native waitUntil so logs stay
  // in the same invocation (Nitro's event.waitUntil alone can orphan async work on Vercel).
  waitUntil(
    (async () => {
      const revalidate = (path: string, extra: Record<string, string> = {}) =>
        $fetch(path, { baseURL, method: 'GET', headers: { ...headers, ...extra } }).catch((err) => {
          console.error(`${tag}   ✗ ${path}`, err?.statusCode ?? err?.message ?? err)
          throw err
        })

      // Warm per-SHA body cache:
      // Cold instances (next deploy) read bodies from the cache instead of re-parsing from GitHub.
      await headCms.init({ metaOnly: false }).catch((err) => {
        console.error(`${tag} cache warm failed`, err?.message ?? err)
      })

      // clear cache storage for payload
      await useStorage('cache:nuxt:payload').clear()

      // Bounded fan-out. A navigation change queues two URLs for *every* page, so
      // an unbounded `Promise.allSettled` would open hundreds of simultaneous
      // connections back into this same function — each of which renders a page.
      const results = await settleInBatches([...paths], REVALIDATE_CONCURRENCY, revalidate)
      const ok = results.filter((r) => r.status === 'fulfilled').length
      console.log(`${tag} complete: ${ok}/${results.length} succeeded`)
    })()
  )

  return {
    ok: true,
    requestId,
    navChanged,
    manifest: {
      added: addedPaths,
      removed: removedPaths,
      metaChanged: metaChangedPaths,
    },
  }
})

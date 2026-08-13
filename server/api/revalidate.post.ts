import type { ContentListFile } from 'comark-content'
import { verify } from '@octokit/webhooks-methods'
import { waitUntil } from '@vercel/functions'

/** Each re-render hits this same deployment, so the ceiling is about not stampeding ourselves. */
const REVALIDATE_CONCURRENCY = 8

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
    console.log(`[content] revalidate push skipped (ref=${payload.ref} !== expected=${expectedRef})`)
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

  // Ahead of the purge fan-out, so a freshly-purged page can't re-render against the stale SHA.
  await cacheSha(branch, headSha)

  console.log(`[content] revalidate push headSha=${headSha ?? '<none>'}`)

  const requestId = getHeader(event, 'x-vercel-id') ?? getHeader(event, 'x-request-id') ?? 'local'
  const tag = `[revalidate:${requestId}]`

  // Planning before we respond costs two `init()` passes against GitHub's ~10s delivery timeout,
  // in exchange for diagnostics in the webhook body. Safe because everything here is idempotent,
  // so a retried delivery only repeats work. If it gets slow, move this into `waitUntil`.
  const beforeSha = payload.before
  let oldItems: Record<string, ContentListFile> = {}
  if (beforeSha && !/^0+$/.test(beforeSha)) {
    try {
      const oldContent = await createSourceContent(beforeSha)
      await oldContent.init()
      oldItems = oldContent.manifest.items
    } catch (err) {
      const message = err instanceof Error ? err.message : err
      console.warn(`${tag} no before-manifest (${beforeSha}) — treating as full revalidate:`, message)
    }
  }

  const headContent = await createSourceContent(headSha, { cache: { driver: cacheDriver(headSha) } })
  await headContent.init()
  const newItems = headContent.manifest.items

  const oldPaths = new Set(Object.keys(oldItems))
  const newPaths = Object.keys(newItems)
  const addedPaths = newPaths.filter((p) => !oldPaths.has(p))
  const removedPaths = [...oldPaths].filter((p) => !(p in newItems))

  const metaChangedPaths: string[] = []
  for (const p of newPaths) {
    if (oldPaths.has(p) && hashManifestItem(oldItems[p]) !== hashManifestItem(newItems[p])) metaChangedPaths.push(p)
  }
  const navChanged = navConfigTouched || addedPaths.length > 0 || removedPaths.length > 0 || metaChangedPaths.length > 0

  // Payload routes are keyed by the build-id query on some deployments, so purge the exact
  // URL the browser loads (`…/_payload.json?<buildId>`).
  const buildId = useRuntimeConfig(event).app.buildId

  // Any content change invalidates the llms indexes and the feed. The search artifacts need no
  // purge: the client hydrates from SHA-pinned `/api/content/blob/<sha>/*` URLs, so a new head
  // simply reads from new URLs and the old entries become unreachable.
  const paths = new Set<string>(['/llms.txt', '/llms-full.txt', '/rss.xml'])
  for (const f of changedFiles) {
    const pageUrl = pageUrlForPath(f)
    if (pageUrl) {
      paths.add(payloadUrlForRoute(pageUrl, buildId))
      paths.add(pageUrl)
    }
    const rawUrl = rawUrlForPath(f)
    if (rawUrl) paths.add(rawUrl)
  }

  // Navigation renders on every page, so a change to it re-renders all of them.
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

  // Vercel's native waitUntil, not Nitro's `event.waitUntil` — that one can orphan async work here.
  waitUntil(
    (async () => {
      const revalidate = (path: string, extra: Record<string, string> = {}) =>
        $fetch(path, { baseURL, method: 'GET', headers: { ...headers, ...extra } }).catch((err) => {
          console.error(`${tag}   ✗ ${path}`, err?.statusCode ?? err?.message ?? err)
          throw err
        })

      // Warm the per-SHA body cache so cold instances skip re-parsing from GitHub.
      // `metaOnly` became `partial` in comark-content 0.2.0 with no alias and consumers straddle both,
      // so send both keys — each version ignores the other's. Not inlined: as a literal,
      // excess-property checking rejects whichever key the installed types don't declare.
      const full = { partial: false, metaOnly: false }
      await headContent.init(full).catch((err) => {
        console.error(`${tag} cache warm failed`, err?.message ?? err)
      })

      await useStorage('cache:nuxt:payload').clear()

      // Bounded: a nav change queues two URLs per page, and every one re-enters this function.
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

import { resolve } from 'node:path'
import { parseMarkdown, type MarkdownDocument } from 'comark'
import rangi from 'comark/plugins/rangi'
import fs from 'comark-content/sources/fs'
import github from 'comark-content/sources/github'
import { geistTheme } from '../../../utils/geist-theme.ts'

// A read source for one example directory. Dev: working tree. Prod: authenticated GitHub — the repo may be
// private, so jsDelivr / unauthenticated raw are out. Mirrors {@link contentSource}'s dev/prod split.
function exampleSource(repo: string, branch: string, dirPath: string) {
  const { docs } = useRuntimeConfig()

  if (import.meta.dev && repo === `${docs.github.owner}/${docs.github.repo}`) {
    // `dirPath` is repo-relative (e.g. `examples/node`).
    return fs(resolve(docs.repoRoot, dirPath))
  }

  return github({
    repo,
    branch,
    path: dirPath,
    token: githubToken(),
    // `branch` is typically an immutable commit SHA => cache hard.
    ttl: 60 * 60 * 24,
  })
}

const CONCURRENCY = 10

// Most files one request will read: cost and payload are linear in the count (each is fetched, parsed,
// highlighted and its AST embedded), and `@branch` is a free cache-key dimension, so ISR can't bound repeats.
const MAX_FILES = 100

async function processInBatches<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY)
    results.push(...(await Promise.all(batch.map(fn))))
  }
  return results
}

export default defineEventHandler(async (event) => {
  const fullPath = (getRouterParam(event, 'path') || '').replace(/\.json$/, '')
  const segments = fullPath.split('/')

  if (segments.length < 3) {
    throw createError({ statusCode: 400, message: 'Expected: {org}/{repo}[@branch]/{path}' })
  }

  const org = segments[0]!
  const repoSegment = segments[1]!
  let repoName: string
  let rawBranch: string

  const atIdx = repoSegment.indexOf('@')
  if (atIdx !== -1) {
    repoName = repoSegment.substring(0, atIdx)
    rawBranch = repoSegment.substring(atIdx + 1).replaceAll('~', '/')
  } else {
    repoName = repoSegment
    rawBranch = 'main'
  }

  // `branch` reaches the GitHub API and, in dev, `git`'s argv; `dirPath` is resolved
  // against the repo root — validate both (see `utils/refs.ts`).
  const branch = parseRef(rawBranch)
  if (!branch) {
    throw createError({ statusCode: 400, message: 'Invalid branch or commit SHA' })
  }

  const dirPath = parseRepoPath(segments.slice(2).join('/'))
  if (!dirPath) {
    throw createError({ statusCode: 400, message: 'Invalid path' })
  }

  // This endpoint carries the GitHub token: only proxy the content repo and explicitly allowed extras.
  const { docs } = useRuntimeConfig(event)
  const allowedRepos = new Set([`${docs.github.owner}/${docs.github.repo}`, ...(docs.codeExplorer?.allowRepos ?? [])])
  if (!allowedRepos.has(`${org}/${repoName}`)) {
    throw createError({ statusCode: 403, message: `Repository ${org}/${repoName} is not allowed` })
  }

  const source = exampleSource(`${org}/${repoName}`, branch, dirPath)

  const files = (await source.keys()).filter((relativePath) => !shouldExclude(relativePath)).sort()

  if (files.length > MAX_FILES) {
    throw createError({
      statusCode: 413,
      message: `${dirPath} has ${files.length} readable files, over the ${MAX_FILES} limit for the code explorer`,
    })
  }

  // Same theme as the docs content pipeline (`server/utils/content.ts`): concrete inline colors
  // with `--shiki-dark` pairs, handled by `html.dark .shiki span` in `theme.css`. The previous
  // `cssVariables` theme emitted `color:var(--shj-*)` which no stylesheet defines, so file
  // contents rendered without visible highlighting.
  const highlightPlugin = rangi({
    theme: geistTheme,
  })
  const fileResults: Record<string, MarkdownDocument> = {}

  await processInBatches(files, async (relativePath) => {
    const content = (await source.getItem(relativePath)) ?? ''

    const markdown = '~~~' + languageFor(relativePath) + '\n' + content + '\n~~~'
    fileResults[relativePath] = await parseMarkdown(markdown, { plugins: [highlightPlugin] })
  })

  const tree = buildTree(files)

  return { tree, files: fileResults }
})

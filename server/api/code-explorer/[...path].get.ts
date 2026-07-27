import { resolve } from 'node:path'
import { parse } from '@comark/nuxt/parse'
import highlight from '@comark/nuxt/plugins/highlight'
import fs from '@comark/cms/sources/fs'
import github from '@comark/cms/sources/github'
import githubLight from '@shikijs/themes/github-light'
import githubDark from '@shikijs/themes/github-dark'

type ComarkTree = Awaited<ReturnType<typeof parse>>

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  vue: 'vue',
  json: 'json',
  md: 'comark',
  mdx: 'comark',
  css: 'css',
  scss: 'css',
  html: 'html',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  astro: 'astro',
  svelte: 'svelte',
  xml: 'xml',
  sql: 'sql',
  graphql: 'graphql',
  dockerfile: 'dockerfile',
  txt: 'text',
}

const EXCLUDED_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'ico',
  'webp',
  'avif',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'mp3',
  'mp4',
  'webm',
  'ogg',
  'zip',
  'tar',
  'gz',
  'br',
])

const EXCLUDED_FILES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  '.DS_Store',
  'Thumbs.db',
])

const EXCLUDED_DIRS = ['.git', 'node_modules', 'dist', '.output', '.nuxt', '.next']

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

function shouldExclude(relativePath: string): boolean {
  const filename = relativePath.split('/').pop() || ''
  const ext = getExtension(filename)

  if (EXCLUDED_EXTENSIONS.has(ext)) return true
  if (EXCLUDED_FILES.has(filename)) return true
  return EXCLUDED_DIRS.some((dir) => relativePath.includes(`/${dir}/`) || relativePath.startsWith(`${dir}/`))
}

interface CodeExplorerTreeItem {
  filename: string
  path: string
  children?: CodeExplorerTreeItem[]
}

function buildTree(filePaths: string[]): CodeExplorerTreeItem[] {
  const root: CodeExplorerTreeItem[] = []

  for (const filePath of filePaths.sort()) {
    const parts = filePath.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!
      const isFile = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      if (isFile) {
        current.push({
          filename: part,
          path: currentPath,
        })
      } else {
        let dir = current.find((item) => item.children && item.path === currentPath)
        if (!dir) {
          dir = {
            filename: part,
            path: currentPath,
            children: [],
          }
          current.push(dir)
        }
        current = dir.children!
      }
    }
  }

  sortTree(root)
  return root
}

function sortTree(items: CodeExplorerTreeItem[]) {
  items.sort((a, b) => {
    const aIsDir = !!a.children
    const bIsDir = !!b.children
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    return a.filename.localeCompare(b.filename)
  })
  for (const item of items) {
    if (item.children) sortTree(item.children)
  }
}

/**
 * A read source for one example directory.
 *
 * Mirrors {@link contentSource}'s dev/prod split (the repo may be private, so
 * jsDelivr / unauthenticated raw can't be used): the working tree in
 * development, the authenticated GitHub source in production.
 */
function exampleSource(repo: string, branch: string, dirPath: string) {
  const { docs } = useRuntimeConfig()

  if (process.env.NODE_ENV === 'development' && repo === `${docs.github.owner}/${docs.github.repo}`) {
    // `dirPath` is repo-relative (e.g. `examples/node`); resolve it against the
    // repo root of the content repo.
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
  let branch: string

  const atIdx = repoSegment.indexOf('@')
  if (atIdx !== -1) {
    repoName = repoSegment.substring(0, atIdx)
    branch = repoSegment.substring(atIdx + 1).replaceAll('~', '/')
  } else {
    repoName = repoSegment
    branch = 'main'
  }

  const dirPath = segments.slice(2).join('/')

  // Only proxy authenticated reads for the content repo (and any explicitly
  // allowed extra repos) — this endpoint carries the GitHub token.
  const { docs } = useRuntimeConfig(event)
  const allowedRepos = new Set([`${docs.github.owner}/${docs.github.repo}`, ...(docs.codeExplorer?.allowRepos ?? [])])
  if (!allowedRepos.has(`${org}/${repoName}`)) {
    throw createError({ statusCode: 403, message: `Repository ${org}/${repoName} is not allowed` })
  }

  const source = exampleSource(`${org}/${repoName}`, branch, dirPath)

  const files = (await source.keys()).filter((relativePath) => !shouldExclude(relativePath)).sort()

  const highlightPlugin = highlight({
    themes: {
      light: githubLight,
      dark: githubDark,
    },
  })
  const fileResults: Record<string, ComarkTree> = {}

  await processInBatches(files, async (relativePath) => {
    const content = (await source.getItem(relativePath)) ?? ''

    const language = EXT_TO_LANG[getExtension(relativePath)] || 'text'
    const markdown = '~~~' + language + '\n' + content + '\n~~~'
    fileResults[relativePath] = await parse(markdown, { plugins: [highlightPlugin] })
  })

  const tree = buildTree(files)

  return { tree, files: fileResults }
})

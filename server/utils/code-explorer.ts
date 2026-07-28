/**
 * Pure filtering and tree-building for the `/api/code-explorer` endpoint.
 *
 * Extracted from the route handler so it can be tested without a source, a GitHub
 * token, or a Shiki highlighter — the route itself is all I/O around these.
 */

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

export function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

/** Shiki language for a file, falling back to unhighlighted text. */
export function languageFor(relativePath: string): string {
  return EXT_TO_LANG[getExtension(relativePath)] || 'text'
}

/** Whether a file should be left out of the explorer (binary, lockfile, build output). */
export function shouldExclude(relativePath: string): boolean {
  const filename = relativePath.split('/').pop() || ''
  const ext = getExtension(filename)

  if (EXCLUDED_EXTENSIONS.has(ext)) return true
  if (EXCLUDED_FILES.has(filename)) return true
  return EXCLUDED_DIRS.some((dir) => relativePath.includes(`/${dir}/`) || relativePath.startsWith(`${dir}/`))
}

export interface CodeExplorerTreeItem {
  filename: string
  path: string
  children?: CodeExplorerTreeItem[]
}

/** Flat list of file paths → nested tree, directories first then alphabetical. */
export function buildTree(filePaths: string[]): CodeExplorerTreeItem[] {
  const root: CodeExplorerTreeItem[] = []

  for (const filePath of [...filePaths].sort()) {
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

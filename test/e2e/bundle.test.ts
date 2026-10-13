import { readdirSync, readFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { init, parse } from 'es-module-lexer'
import { resolveModuleURL } from 'exsolve'
import { expect, it } from 'vitest'

const serverDir = fileURLToPath(new URL('../../playground/.output/server/', import.meta.url))

// Optional peers imported behind a try/catch, absent unless a site installs them.
const OPTIONAL_IMPORTS = new Set([
  // `@nuxtjs/mcp-toolkit` Code Mode.
  'secure-exec',
])

/** The bundled chunks: the traced `node_modules/` are third-party files Nitro copied as they are. */
function bundledFiles(): string[] {
  return readdirSync(serverDir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => !relative(serverDir, file).startsWith('node_modules'))
}

// A lazy chunk (a component, a route) only fails once requested, so the route crawl alone can miss it.
it('every import in the server bundle resolves inside the build output', async () => {
  await init()
  const files = bundledFiles()
  const broken: string[] = []
  let checked = 0

  for (const file of files) {
    const [imports] = parse(readFileSync(file, 'utf8'))
    for (const entry of imports) {
      // `import.meta`, computed dynamic imports and template globs name no single module.
      const specifier = entry.type === 'dynamic' && entry.glob ? undefined : entry.specifier
      if (!specifier || isBuiltin(specifier) || OPTIONAL_IMPORTS.has(specifier)) continue
      checked++
      const resolved = resolveModuleURL(specifier, { from: pathToFileURL(file), try: true })
      // Resolving into the repo's own `node_modules` works locally but not once deployed.
      if (!resolved?.startsWith(pathToFileURL(serverDir).href)) {
        broken.push(`${relative(serverDir, file)} imports ${specifier}`)
      }
    }
  }

  // Guards against a vacuous pass, e.g. the lexer reporting no specifiers after an API change.
  expect(checked).toBeGreaterThan(files.length)
  expect(broken).toEqual([])
})

import { readFileSync } from 'node:fs'
import { resolveModulePath } from 'exsolve'

/**
 * The icon collections this layer's components draw from.
 *
 * `lucide` for UI affordances, `simple-icons` for brand marks, `vscode-icons` for
 * the file-type icons Nuxt UI's `CodeIcon` derives from a filename.
 */
export const LAYER_ICON_COLLECTIONS = ['lucide', 'simple-icons', 'vscode-icons']

/** Parsed collections, memoized — the client-bundle template regenerates in dev. */
let cache: IconifyJSONish[] | undefined

/** The shape `@nuxt/icon` accepts in `customCollections` (a raw `IconifyJSON`). */
interface IconifyJSONish {
  prefix: string
  icons: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Load the layer's icon collections as data, resolved from the layer itself.
 *
 * `@nuxt/icon` discovers `@iconify-json/*` by walking `node_modules/@iconify-json`
 * upwards from the consuming app's `rootDir` and `workspaceDir` — and nowhere else.
 * These packages are dependencies of this layer, so under any non-hoisting install
 * (pnpm's default `isolated` linker) they sit in the virtual store where that walk
 * can't reach them, and the consumer resolves zero collections: an empty client
 * bundle, and every icon fetched from api.iconify.design at runtime.
 *
 * Handing the data over directly is the only lever that doesn't depend on the
 * consumer's node_modules layout. `modulesDir` is not an option — @nuxt/icon never
 * consults it (see `getResolvePaths`, which reads only `rootDir`/`workspaceDir`).
 *
 * Done unconditionally rather than only when discovery fails, so behaviour is the
 * same whether the layer is installed as a package, extended from a local path, or
 * run from this repo's own playground. It isn't extra work: in the working case
 * @nuxt/icon parses these same files itself.
 */
export function layerIconCollections(): IconifyJSONish[] {
  cache ??= LAYER_ICON_COLLECTIONS.map((prefix) => {
    const path = resolveModulePath(`@iconify-json/${prefix}/icons.json`, { from: import.meta.url })
    return JSON.parse(readFileSync(path, 'utf8')) as IconifyJSONish
  })
  return cache
}

import { readFileSync } from 'node:fs'
import { resolveModulePath } from 'exsolve'

// Icon collections this layer's components draw from: `lucide` (UI affordances), `simple-icons` (brand marks),
// `vscode-icons` (the file-type icons Nuxt UI's `CodeIcon` derives from a filename).
export const LAYER_ICON_COLLECTIONS = ['lucide', 'simple-icons', 'vscode-icons']

const LAYER_ICON_SUBSETS: Record<string, string[]> = {
  logos: ['angular-icon', 'nextjs-icon', 'nuxt-icon', 'react', 'svelte-icon', 'vite-icon'],
  unjs: ['nitro'],
}

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
 * `@nuxt/icon` discovers `@iconify-json/*` only by walking `node_modules/@iconify-json` up from the consuming
 * app's `rootDir`/`workspaceDir` (`modulesDir` is never consulted — see `getResolvePaths`). These packages are
 * dependencies of *this layer*, so under a non-hoisting install (pnpm's default `isolated` linker) they sit in
 * the virtual store, out of reach: zero collections, an empty client bundle, every icon fetched from
 * api.iconify.design at runtime. Done unconditionally, so behaviour is the same however the layer is consumed.
 */
export function layerIconCollections(): IconifyJSONish[] {
  cache ??= [
    ...LAYER_ICON_COLLECTIONS.map((prefix) => readCollection(prefix)),
    ...Object.entries(LAYER_ICON_SUBSETS).map(([prefix, names]) => {
      const collection = readCollection(prefix)
      const icons: Record<string, unknown> = {}
      for (const name of names) {
        // A rename upstream must fail loudly, not ship a silently missing icon.
        if (!collection.icons[name]) throw new Error(`Icon "${prefix}:${name}" is missing from @iconify-json/${prefix}`)
        icons[name] = collection.icons[name]
      }
      return { ...collection, icons, aliases: {} }
    }),
  ]
  return cache
}

function readCollection(prefix: string): IconifyJSONish {
  const path = resolveModulePath(`@iconify-json/${prefix}/icons.json`, { from: import.meta.url })
  return JSON.parse(readFileSync(path, 'utf8')) as IconifyJSONish
}

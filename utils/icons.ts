import { resolveModulePath } from 'exsolve'

// Collections served by this layer's `/api/_nuxt_icon` endpoint.
// - `lucide`: UI affordances.
// - `simple-icons`, `logos`: brand marks, mostly reached from consumer content.
// - `vscode-icons`: the file-type icons Nuxt UI's `CodeIcon` derives from a filename.
// - `unjs`: icons from UnJS's `unjs/icons` repository.
// - `logos`: icons from logos.
export const LAYER_ICON_COLLECTIONS = ['lucide', 'simple-icons', 'vscode-icons', 'logos', 'unjs']

/**
 * Nitro aliases pinning each collection to the copy installed beside this layer.
 */
export function layerIconAliases(): Record<string, string> {
  return Object.fromEntries(LAYER_ICON_COLLECTIONS.map((prefix) => {
    const id = `@iconify-json/${prefix}/icons.json`
    return [id, resolveModulePath(id, { from: import.meta.url })]
  }))
}

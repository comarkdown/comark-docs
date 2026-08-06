import type { ContentOptions } from 'comark-content'

/**
 * Default (no-op) hook over the options `createSourceContent` builds for every content instance.
 *
 * Consumers override it by exporting a function of the same name from their own `server/utils/`:
 * the layer registers this one as an auto-import with a negative priority, so a scanned export
 * (unimport's default priority of 1) shadows it. A plain `server/utils/` file in the layer could
 * not be shadowed — Nitro scans layer dirs *after* the consumer's, and equal-priority collisions
 * resolve to the last one scanned.
 */
export function extendContent<T extends ContentOptions>(options: T): T {
  return options
}

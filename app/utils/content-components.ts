import type { Component } from 'vue'

/**
 * Names the layer's Markdown components after their file: `content/CodeExplorer.vue` renders
 * `::code-explorer`. Each page globs its own folder (docs pages `content/`, the landing page
 * `content/landing/`) and passes the result to `MarkdownDocument`, so none is global and neither
 * page loads the other's, such as the landing demo's Markdown parser. `lint.mjs` reads both folders.
 */
export function byFileName(modules: Record<string, unknown>): Record<string, Component> {
  return Object.fromEntries(
    Object.entries(modules).map(([path, component]) => [path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, ''), component as Component]),
  )
}

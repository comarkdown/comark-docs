import type { Component } from 'vue'

/**
 * The layer's Markdown components, named after their file: `content/CodeExplorer.vue` renders
 * `::code-explorer`. The pages pass them to `MarkdownDocument` explicitly, so none is global.
 * `lint.mjs` reads the same folder.
 */
export const contentComponents = Object.fromEntries(
  Object.entries(import.meta.glob<Component>('../components/content/*.{vue,ts}', { eager: true, import: 'default' }))
    .map(([path, component]) => [path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, ''), component]),
)

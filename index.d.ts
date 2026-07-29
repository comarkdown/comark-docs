/**
 * Public types for the layer. Deliberately declares no module augmentations: Nuxt already generates
 * `comarkDocs` from the module's `configKey` (`.nuxt/types/modules.d.ts`) and `RuntimeConfig['docs']`
 * from the `runtimeConfig.docs` object `modules/config.ts` seeds (`.nuxt/types/runtime-config.d.ts`).
 * Re-declaring them here was also unverifiable — no tsconfig includes this file, so the hand-written
 * shapes were never checked against the ones they duplicated and could drift silently.
 */
export type { ComarkDocsOptions } from './modules/config'

/**
 * Public types for the layer.
 *
 * This file deliberately declares no module augmentations. It used to augment
 * `NuxtConfig`/`NuxtOptions` with `comarkDocs` and `RuntimeConfig` with `docs`, but
 * Nuxt already generates both for the consuming app:
 *
 * - `comarkDocs` comes from the module's `configKey` (`.nuxt/types/modules.d.ts`)
 * - `RuntimeConfig['docs']` is inferred from the `runtimeConfig.docs` object that
 *   `modules/config.ts` seeds (`.nuxt/types/runtime-config.d.ts`)
 *
 * Re-declaring them here was not only redundant but unverifiable: no tsconfig
 * includes this file, so the hand-written shapes were never checked against the
 * ones they duplicated and could drift silently.
 */
export type { ComarkDocsOptions } from './modules/config'

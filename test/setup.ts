/**
 * Nitro auto-imports, provided by hand.
 *
 * Modules under `server/` are written against Nitro's auto-import globals rather
 * than explicit imports, so importing one directly in a test leaves those names
 * undefined. Rather than pull in the whole Nuxt/Nitro test harness for a handful of
 * pure functions, the tests declare the few globals they touch here.
 *
 * `useRuntimeConfig` returns the shape `modules/config.ts` seeds. Anything a test
 * needs to vary, it overrides via `setRuntimeConfig`.
 */
export interface TestRuntimeConfig {
  docs: {
    contentDir: string
    contentPath: string
    repoRoot: string
    github: { owner: string; repo: string; branch: string }
  }
}

const defaults: TestRuntimeConfig = {
  docs: {
    contentDir: 'content',
    contentPath: '/repo/content',
    repoRoot: '/repo',
    github: { owner: 'comarkdown', repo: 'comark-docs', branch: 'main' },
  },
}

let runtimeConfig: TestRuntimeConfig = structuredClone(defaults)

/** Override the runtime config for the current test. Reset with `resetRuntimeConfig`. */
export function setRuntimeConfig(partial: Partial<TestRuntimeConfig['docs']>) {
  runtimeConfig = { docs: { ...runtimeConfig.docs, ...partial } }
}

export function resetRuntimeConfig() {
  runtimeConfig = structuredClone(defaults)
}

const globals = globalThis as Record<string, unknown>

globals.useRuntimeConfig = () => runtimeConfig

// Minimal stand-in for h3's `createError`: the tests only assert that a throw
// happened and what status it carried.
globals.createError = (input: { statusCode?: number; statusMessage?: string; message?: string }) => {
  const error = new Error(input.statusMessage || input.message || 'Error') as Error & { statusCode?: number }
  error.statusCode = input.statusCode
  return error
}

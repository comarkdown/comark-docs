// Nitro auto-imports, provided by hand: modules under `server/` are written against Nitro's globals, so
// importing one directly in a test leaves those names undefined. Declaring the few the tests touch here beats
// pulling in the whole Nuxt/Nitro harness for a handful of pure functions. `useRuntimeConfig` returns the shape
// `modules/config.ts` seeds.
import memoryDriver from 'unstorage/drivers/memory'

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

// Minimal stand-in for h3's `createError`: tests only assert that a throw happened and its status.
globals.createError = (input: { statusCode?: number; statusMessage?: string; message?: string }) => {
  const error = new Error(input.statusMessage || input.message || 'Error') as Error & { statusCode?: number }
  error.statusCode = input.statusCode
  return error
}

globals.refCacheDriver = () => memoryDriver()

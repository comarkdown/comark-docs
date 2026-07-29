import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Transform without a tsconfig. oxc would otherwise resolve the root stub, which
  // points into `playground/.nuxt/` and so only exists after `nuxt prepare` — a fresh
  // clone (and CI, which tests before preparing) ran zero tests. Nothing under test
  // needs tsconfig semantics. Absent from Vite's `OxcOptions` type but forwarded to
  // `transformSync`, hence the cast.
  oxc: { tsconfig: false } as never,
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    environment: 'node',
  },
})

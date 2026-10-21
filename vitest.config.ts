import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Transform without a tsconfig. oxc would otherwise resolve the root stub, which
  // points into `playground/.nuxt/` and so only exists after `nuxt prepare` — a fresh
  // clone (and CI, which tests before preparing) ran zero tests. Nothing under test
  // needs tsconfig semantics. Absent from Vite's `OxcOptions` type but forwarded to
  // `transformSync`, hence the cast.
  oxc: { tsconfig: false } as never,
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts', 'modules/**/*.test.ts'],
          exclude: ['test/e2e/**', 'test/vercel/**'],
          setupFiles: ['test/setup.ts'],
          environment: 'node',
        },
      },
      {
        // Runs against the built playground (`pnpm build`), so it catches what only breaks once bundled.
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.test.ts'],
          globalSetup: ['test/e2e/setup.ts'],
          environment: 'node',
          // A cold page pulls its content from GitHub and OG images render through satori.
          testTimeout: 60_000,
        },
      },
      {
        // Reads the Vercel build output (`NITRO_PRESET=vercel pnpm build`), checking what a deploy would get.
        test: {
          name: 'vercel',
          include: ['test/vercel/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})

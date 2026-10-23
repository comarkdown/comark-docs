import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: { tsconfig: false } as never,
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts', 'modules/**/*.test.ts', 'scripts/**/*.test.mjs'],
          exclude: ['test/e2e/**', 'test/vercel/**', 'test/smoke/**'],
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
      {
        // The e2e suite against a deployment (`SMOKE_URL`), plus what only Vercel can answer.
        test: {
          name: 'smoke',
          include: ['test/e2e/**/*.test.ts', 'test/smoke/**/*.test.ts'],
          // Reads the local build output, which a deployment does not have.
          exclude: ['test/e2e/bundle.test.ts'],
          globalSetup: ['test/smoke/setup.ts'],
          environment: 'node',
          // Cold starts included.
          testTimeout: 60_000,
        },
      },
    ],
  },
})

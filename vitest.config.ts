import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Transform without consulting any tsconfig.
  //
  // oxc otherwise resolves the *nearest* tsconfig per transformed file, and the root
  // `tsconfig.json` is a project-references stub pointing into `playground/.nuxt/`,
  // which only exists once `nuxt prepare` has run. So `pnpm test` from a fresh clone
  // — or in CI, which runs it before `dev:prepare` on purpose so it fails fast —
  // reported `[TSCONFIG_ERROR] Tsconfig not found` for every file and ran zero tests,
  // while passing locally purely because a generated `.nuxt` happened to be lying
  // around. Reproduced by moving `playground/.nuxt` aside.
  //
  // Nothing under test needs tsconfig-driven semantics: no decorators, no path
  // aliases, relative imports throughout. Opting out makes the suite hermetic
  // instead of dependent on build artefacts. `test/tsconfig.json` still exists, for
  // editors — it is not what the transform reads.
  //
  // `tsconfig` is absent from Vite's `OxcOptions` type but forwarded verbatim to
  // `transformSync`, hence the cast.
  oxc: { tsconfig: false } as never,
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    environment: 'node',
  },
})

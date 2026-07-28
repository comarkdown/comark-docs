import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

/**
 * Correctness-only lint.
 *
 * `stylistic: false` is deliberate: the codebase is already consistently formatted,
 * and enabling the stylistic ruleset would rewrite every file and bury real changes
 * in whitespace. What's wanted here is the class of bug that typecheck and tests
 * both miss — and it earned its place immediately: it caught a `const xml` in
 * `rss.xml.get.ts` shadowing a same-named helper in the same scope, which would have
 * thrown a TDZ `ReferenceError` on every request to the feed.
 */
export default createConfigForNuxt({
  features: {
    stylistic: false,
    tooling: true,
  },
  dirs: {
    src: ['./playground', '.'],
  },
})
  .append({
    ignores: ['playground/.nuxt/**', 'playground/.output/**', 'playground/.vercel/**', 'dist/**'],
  })
  .append({
    rules: {
      // `any` here marks genuinely untyped boundaries — markdown frontmatter (whose
      // shape is content, not code), `appConfig` before the consumer's app.config is
      // generated, and `catch` bindings. Kept visible as a warning rather than
      // silenced per-site, so a careless new one still shows up.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  })
  .append({
    // Page, layout and error component names come from Nuxt's file-based routing —
    // `index.vue`, `docs.vue`, `[...slug].vue` are the framework's naming, not ours.
    // `Browser.vue` is exempt for a different reason: it's addressed from markdown
    // (`::browser`), so its name is part of the content API.
    files: ['app/pages/**/*.vue', 'app/layouts/**/*.vue', 'app/error.vue', 'app/components/Browser.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  })

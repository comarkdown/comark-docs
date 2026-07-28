# comark-docs

A [Nuxt layer](https://nuxt.com/docs/getting-started/layers) for CMS-driven documentation sites, powered by [`@comark/cms`](https://github.com/comarkdown/comark-cms).

Content lives as Markdown in your repo and is served **at request time** — parsed, indexed and cached through `@comark/cms` — instead of being bundled at build time. Content pushes go live in production without a redeploy.

## Features

- **Instant production content** — GitHub-sourced content pinned to a commit SHA, ISR-cached HTML, revalidated on push by a GitHub webhook (`/api/revalidate`).
- **Versioned previews** — any branch (`/tree/:branch`) or commit (`/blob/:sha`) can be previewed through versioned URLs.
- Docs UI built with [Nuxt UI](https://ui.nuxt.com): sidebar navigation, search (`⌘K`), TOC, prev/next links, version history panel.
- SEO & AEO out of the box: sitemap, robots, canonical URLs, OG images (Satori), JSON-LD, `llms.txt` / `llms-full.txt`, raw markdown mirrors (`/raw/**`), RSS, MCP server (`/mcp`).

## Usage

```bash
pnpm add comark-docs@github:comarkdown/comark-docs
```

> Not published to npm yet — install from git. pnpm pins the resolved commit in your lockfile;
> `pnpm update comark-docs` moves it forward.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['comark-docs'],
  site: {
    url: 'https://docs.example.com',
    name: 'My Project',
  },
})
```

Put your Markdown in `content/` (numeric-prefixed dirs for ordering, `.navigation.yml` per section) and run `nuxt dev`.

### Configuration

Branding and navigation via `app.config.ts`:

```ts
export default defineAppConfig({
  header: {
    // Main navigation tabs; omit to derive one tab per top-level section
    nav: [
      { label: 'Documentation', sections: ['getting-started', 'concepts'] },
      { label: 'API Reference', sections: ['reference'] },
    ],
    links: [{ icon: 'i-simple-icons-github', to: 'https://github.com/org/repo', target: '_blank' }],
  },
  footer: {
    credits: `Copyright © ${new Date().getFullYear()}`,
    links: [{ icon: 'i-lucide-rss', to: '/rss.xml', target: '_blank', 'aria-label': 'RSS Feed' }],
  },
})
```

> Nuxt merges `app.config.ts` across layers with [defu](https://github.com/unjs/defu), which **concatenates arrays**. A consumer's list is *appended to* the layer's, not substituted for it — which is why every array default in the layer is empty. Keep it that way.

`comarkDocs` in `nuxt.config.ts` covers `isr` (`false` disables the generated ISR route rules) and `codeExplorer.allowRepos`. The GitHub repo, branch and content directory are inferred from the local git checkout and `VERCEL_GIT_*`; override them at runtime with `NUXT_DOCS_*` env vars (`NUXT_DOCS_GITHUB_OWNER`, `NUXT_DOCS_GITHUB_REPO`, `NUXT_DOCS_GITHUB_BRANCH`, …).

Branding is config, not components — the header cluster, footer credit and OG template all live in the layer:

```ts
export default defineAppConfig({
  header: {
    logo: { mark: 'comark-cms' },                                          // a wordmark shipped with the layer
    ecosystem: [{ mark: 'comark', to: 'https://comark.dev', label: 'Comark' }],
  },
  footer: { icon: 'i-simple-icons-vercel', owner: 'Vercel' },
  docs: { ogImage: { mark: 'comark-cms', tagline: 'The content layer for Markdown' } },
})
```

The wordmarks (`LogoComark`, `LogoComarkCms`) live in the layer because each site needs both: its own in the header, its sibling's in the ecosystem popover. Add a new one as `LogoX.vue` plus a branch in `LogoMark.vue` — and in `OgImageDocs.satori.vue`, which has to inline them (nuxt-og-image's island renderer can't resolve nested components).

Components can still be replaced by shipping a same-named one (`AppHeader`, `AppFooter`, `AppHeaderBrand`, `OgImage/OgImageDocs.satori.vue`), but neither site needs to.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | GitHub source reads + GraphQL history/RSS |
| `WEBHOOK_SECRET` | GitHub push webhook HMAC (`/api/revalidate`) |
| `VERCEL_BYPASS_TOKEN` | ISR purge on revalidation |
| `NUXT_OG_IMAGE_SECRET` | OG image signing |

## Development

```bash
pnpm install
pnpm dev # runs the playground
```

To develop the layer against a consumer app in a sibling checkout:

```bash
COMARK_DOCS_LAYER=../../comark-docs pnpm dev
```

> **Known issue:** in dev, hydration intermittently dies with
> `elkjs ... does not provide an export named 'default'`, showing a 500 page. SSR output is correct —
> the failure is client-side only. `elkjs` is `beautiful-mermaid`'s CommonJS dependency and doesn't
> reliably get pre-bundled; the `optimizeDeps.include` entries below help but don't fully fix it.
> Reproduces in the layer's own playground too. Reload usually clears it. Not yet root-caused.

## License

[MIT](./LICENSE)

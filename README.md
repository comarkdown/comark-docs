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
pnpm add comark-docs
```

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
    links: [],
  },
})
```

The GitHub repo, branch and content directory are inferred from the local git repo (and `VERCEL_GIT_*` env in production). Override via `comarkDocs` in `nuxt.config.ts` or `NUXT_DOCS_*` env vars.

Components like `AppHeaderLogo`, `AppHeader`, `AppFooter` or `OgImageDocs.satori.vue` can be overridden by shipping a same-named component in your app.

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

## License

[MIT](./LICENSE)

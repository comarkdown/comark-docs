# comark-docs

A [Nuxt layer](https://nuxt.com/docs/getting-started/layers) for documentation sites, powered by [`comark-content`](https://github.com/comarkdown/comark-content).

Content lives as Markdown in your repo and is served **at request time** — parsed, indexed and cached through `comark-content` — instead of being bundled at build time. Content pushes go live in production without a redeploy.

**Documentation: [docs-template.comark.dev](https://docs-template.comark.dev)** — built with this layer, from the [`playground/`](./playground) in this repo.

## Features

- **Instant production content** — GitHub-sourced content pinned to a commit SHA, ISR-cached HTML, revalidated on push by a GitHub webhook (`/api/revalidate`).
- **Versioned previews** — any branch (`/tree/:branch`) or commit (`/blob/:sha`) can be previewed through versioned URLs.
- Docs UI built with [Nuxt UI](https://ui.nuxt.com): sidebar navigation, search (`⌘K`), TOC, prev/next links, version history panel.
- SEO out of the box: sitemap, robots, canonical URLs, OG images (Satori), JSON-LD, RSS.
- Markdown for agents through [nuxt-agent-discovery](https://github.com/benjamincanac/nuxt-agent-discovery): content negotiation on every page URL, raw markdown mirrors (`/raw/**`), `llms.txt` / `llms-full.txt`, `sitemap.md`, `/.well-known/api-catalog`, an MCP server (`/mcp`) with its server card, Agent Skills discovery (`/.well-known/skills/`).

## Quick start

Not published to npm yet — install from git (your lockfile pins the resolved commit):

```bash
pnpm add comark-docs@github:comarkdown/comark-docs
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

From there, the docs cover everything:

- [Installation](https://docs-template.comark.dev/getting-started/installation)
- [Configuration](https://docs-template.comark.dev/getting-started/configuration) — branding via `app.config.ts`, `comarkDocs` options, environment variables
- [Writing pages](https://docs-template.comark.dev/writing/pages), [components](https://docs-template.comark.dev/writing/components) and the [landing page](https://docs-template.comark.dev/writing/landing-page)
- [Architecture](https://docs-template.comark.dev/concepts/architecture) and [versioned previews](https://docs-template.comark.dev/concepts/versioned-previews)
- [Deploying on Vercel](https://docs-template.comark.dev/deployment/vercel) — webhook, Ignored Build Step, content rollback

## Agent Skills

Drop skills into a `skills/` directory at the app root and [nuxt-agent-discovery](https://github.com/benjamincanac/nuxt-agent-discovery) serves them at `/.well-known/skills/`, following the [Agent Skills Discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc) (v0.1). Users install them with:

```bash
npx skills add https://your-docs-domain.com
```

Each skill is a directory with a `SKILL.md` whose frontmatter includes a `description`; `name` defaults to the directory name. Skills are scanned at build time from the filesystem (they ship with the app, not with GitHub-sourced content), so a skill change needs a redeploy. Override the directory with `agentDiscovery.skills.dir`.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `⌘K` | Search |
| `d` | Toggle dark mode |
| `g` `h` | Toggle the version-history panel |

## Notes for layer development

- **Wordmarks** (`LogoComark`, `LogoComarkContent`) live in the layer; add a new one as `LogoX.vue` plus a branch in `LogoMark.vue` — and in `OgImageDocs.satori.vue`, which has to inline the icon artwork by hand (nuxt-og-image's island renderer can't resolve nested components). A mark missing there silently falls back to the wordmark.
- **`app.config.ts` merging**: Nuxt merges app config across layers with [defu](https://github.com/unjs/defu), which **concatenates arrays** — a consumer's list is appended to the layer's, not substituted for it. Keep every array default in the layer empty.
- **Content classes**: `app/assets/css/theme.css` ships plain classes for use in Markdown (`.caret`, `.section-label`, `.syntax-*`). Nothing in the layer references them — they exist for the content repos.
- Components can be replaced by shipping a same-named one (`AppHeader`, `AppFooter`, `AppHeaderBrand`, `OgImage/OgImageDocs.satori.vue`).

## Development

```bash
pnpm install
pnpm dev       # runs the playground
pnpm lint      # correctness-only ESLint (no stylistic rules — see eslint.config.mjs)
pnpm test      # Vitest over the pure utils
pnpm typecheck # vue-tsc across the layer + playground
```

To develop the layer against a consumer app in a sibling checkout:

```bash
COMARK_DOCS_LAYER=../../comark-docs pnpm dev
```

## License

[MIT](./LICENSE)

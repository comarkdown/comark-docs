# comark-docs

The [Nuxt layer](https://nuxt.com/docs/getting-started/layers) behind the Comark documentation sites, powered by [`comark-content`](https://github.com/comarkdown/comark-content).

Content lives as Markdown in your repo and is served **at request time** — parsed, indexed and cached through `comark-content` — instead of being bundled at build time. Content pushes go live in production without a redeploy.

> **Scope.** This is a shared layer for two specific sites — the Comark docs and the Comark Content docs — not a general-purpose docs starter. That's why some things that would be configurable in a published theme are simply baked in: the Vercel OSS mark in the header cluster, the `comark` / `comark-content` wordmarks, and `content/` as the content directory. Anything both sites need to differ on is config; anything they share is code, so it isn't written twice.

## Features

- **Instant production content** — GitHub-sourced content pinned to a commit SHA, ISR-cached HTML, revalidated on push by a GitHub webhook (`/api/revalidate`).
- **Versioned previews** — any branch (`/tree/:branch`) or commit (`/blob/:sha`) can be previewed through versioned URLs.
- Docs UI built with [Nuxt UI](https://ui.nuxt.com): sidebar navigation, search (`⌘K`), TOC, prev/next links, version history panel.
- SEO & AEO out of the box: sitemap, robots, canonical URLs, OG images (Satori), JSON-LD, `llms.txt` / `llms-full.txt`, raw markdown mirrors (`/raw/**`), RSS, MCP server (`/mcp`), Agent Skills discovery (`/.well-known/skills/` and `/.well-known/agent-skills/`).

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
    credits: `© ${new Date().getFullYear()}`,
    links: [{ icon: 'i-lucide-rss', to: '/rss.xml', target: '_blank', 'aria-label': 'RSS Feed' }],
  },
})
```

> Nuxt merges `app.config.ts` across layers with [defu](https://github.com/unjs/defu), which **concatenates arrays**. A consumer's list is *appended to* the layer's, not substituted for it — which is why every array default in the layer is empty. Keep it that way.

`comarkDocs` in `nuxt.config.ts` covers `isr` (`false` disables the generated ISR route rules), `codeExplorer.allowRepos`, `contentDir`, and `skills.dir`. The GitHub repo, branch and content directory are inferred from the local git checkout and `VERCEL_GIT_*`; override them at runtime with `NUXT_DOCS_*` env vars (`NUXT_DOCS_GITHUB_OWNER`, `NUXT_DOCS_GITHUB_REPO`, `NUXT_DOCS_GITHUB_BRANCH`, …).

> **Builds without `.git`.** The content directory is stored relative to the *repository* root, since that's what the GitHub source, the edit links and the push webhook all need — an app in `docs/` becomes `docs/content`. That's derived by relativising against the git root, so a build that can't see `.git` (a shallow or context-limited Docker build, an exported tarball) can only assume the app *is* the repository root. For a single-app repo that's correct; for an app in a subdirectory it silently points every production content read at a path that doesn't exist, and dev won't show it because dev reads the absolute path. The build warns when it has to assume. Set `comarkDocs.contentDir` (or `NUXT_DOCS_CONTENT_DIR`) to silence it authoritatively.

Branding is config, not components — the header cluster, footer credit and OG template all live in the layer:

```ts
export default defineAppConfig({
  header: {
    logo: { mark: 'comark-content' },                                          // a wordmark shipped with the layer
    ecosystem: [{ mark: 'comark', to: 'https://comark.dev', label: 'Comark' }],
  },
  footer: { icon: 'i-simple-icons-vercel', owner: 'Vercel' },
  docs: { ogImage: { mark: 'comark-content', tagline: 'The content layer for Markdown' } },
})
```

The wordmarks (`LogoComark`, `LogoComarkContent`) live in the layer because each site needs both: its own in the header, its sibling's in the ecosystem popover. Add a new one as `LogoX.vue` plus a branch in `LogoMark.vue` — and in `OgImageDocs.satori.vue`, which has to inline them (nuxt-og-image's island renderer can't resolve nested components).

`docs.ogImage.mark` takes the same names plus `wordmark`, which draws `seo.siteName` as text. The OG template inlines the *icon* of each mark rather than the full lockup, since it renders in a 200px column — so the artwork there is a second copy that has to be kept in step with the `Logo*.vue` component by hand. If you add a mark and only update `LogoMark.vue`, the OG image silently falls back to the wordmark.

Components can still be replaced by shipping a same-named one (`AppHeader`, `AppFooter`, `AppHeaderBrand`, `OgImage/OgImageDocs.satori.vue`), but neither site needs to.

### Agent Skills

Drop skills into a `skills/` directory at the app root and the layer serves them at both [RFC](https://github.com/cloudflare/agent-skills-discovery-rfc) paths: `/.well-known/skills/` (v0.1) and `/.well-known/agent-skills/` (v0.2). Users install them with:

```bash
npx skills add https://your-docs-domain.com
```

```
my-docs/
└─ skills/
    └─ my-product/
        ├─ SKILL.md
        └─ references/
            └─ api.md
```

Each skill needs a `SKILL.md` whose frontmatter includes a `description`. `name` defaults to the directory name and must match the [Agent Skills naming spec](https://agentskills.io/specification#name-field) (lowercase letters, numbers and hyphens). The v0.2 index lists every skill as `skill-md` (SHA-256 of `SKILL.md`); supporting files are still served next to it. Discovery:

```
GET /.well-known/skills/index.json
GET /.well-known/skills/{skill-name}/SKILL.md
GET /.well-known/skills/{skill-name}/references/api.md

GET /.well-known/agent-skills/index.json
GET /.well-known/agent-skills/{skill-name}/SKILL.md
GET /.well-known/agent-skills/{skill-name}/references/api.md
```

Override the directory with `comarkDocs.skills.dir` if it isn't `skills/`. Skills are scanned at build time from the filesystem (they ship with the app, not with GitHub-sourced content), so a skill change needs a redeploy.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `⌘K` | Search |
| `d` | Toggle dark mode |
| `g` `h` | Toggle the version-history panel |

Single-key shortcuts are safe because `defineShortcuts` ignores keypresses while an input is focused. `g` `h` is a chained sequence rather than `⌘H`, which macOS claims as Hide Window before the page sees it.

### Content classes

`app/assets/css/theme.css` ships a few plain classes for use in Markdown, since Tailwind scans `content/`: `.caret` (a blinking terminal caret), `.section-label` (a pill-shaped eyebrow label), and `.syntax-hash` / `.syntax-asterisk` / `.syntax-colon` / `.syntax-bracket` / `.syntax-text` for hand-marked-up syntax examples. Nothing in the layer references them — they exist for the content repos.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | GitHub source reads + GraphQL history/RSS |
| `WEBHOOK_SECRET` | GitHub push webhook HMAC (`/api/revalidate`) |
| `VERCEL_BYPASS_TOKEN` | ISR purge on revalidation. Needed at **build** time too — it's baked into `nitro.vercel.config`, so a runtime-only value leaves purging broken |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Lets `/api/revalidate` call back through the deployment protection wall. Set automatically on Vercel |
| `NUXT_OG_IMAGE_SECRET` | OG image signing |

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

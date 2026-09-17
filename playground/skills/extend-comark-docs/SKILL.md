---
name: extend-comark-docs
description: >
  Set up a documentation site with the comark-docs Nuxt layer. Use when creating
  a docs app, installing the layer, extending nuxt.config, or wiring site name and URL.
---

# Extend comark-docs

Add the layer to a Nuxt app and point it at Markdown in `content/`.

## Install

```bash
pnpm add comark-docs@github:comarkdown/comark-docs
```

## Extend

```ts
export default defineNuxtConfig({
  extends: ['comark-docs'],
  site: {
    url: 'https://docs.example.com',
    name: 'My Project',
  },
})
```

Put Markdown in `content/` (numeric-prefixed dirs for ordering, `.navigation.yml` per section) and run `nuxt dev`.

For branding (`header`, `footer`, wordmarks) see `app.config.ts` on the consuming site. GitHub repo, branch and content directory are inferred from git; override with `NUXT_DOCS_*` if needed.

Read more: [Introduction](/getting-started/introduction), [Installation](/getting-started/installation), [Configuration](/getting-started/configuration).

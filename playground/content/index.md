---
title: A Nuxt layer for content-driven documentation
description: "comark-docs is a Nuxt layer for documentation sites powered by comark-content: Markdown served at request time, ISR-cached, revalidated on push."
navigation: false
---

::u-page-hero
---
orientation: horizontal
---
#title
Docs that ship without a redeploy.

#description
The first Markdown-driven docs site where content goes live on `git push`. No rebuild, no redeploy. Served at request time through [Comark Content](https://content.comark.dev), cached at the edge, revalidated by a webhook. And every branch or commit is already a live preview.

#links
  :::u-button
  ---
  to: /getting-started/introduction
  size: lg
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::

  :::u-button
  ---
  to: /concepts/architecture
  size: lg
  color: neutral
  variant: outline
  ---
  How it works
  :::

#default
```ts [nuxt.config.ts]
export default defineNuxtConfig({
  extends: ['comark-docs'],
  site: {
    url: 'https://docs.example.com',
    name: 'My Project',
  },
})
```
::

::landing-features
#headline
Features

#title
Everything a docs site needs

#default
  :::landing-feature-card{icon="i-lucide-zap" to="/concepts/architecture"}
  #title
  Instant content

  #description
  Push Markdown to your production branch and it's live in seconds. A webhook purges exactly the pages that changed.
  :::

  :::landing-feature-card{icon="i-lucide-git-branch" to="/concepts/versioned-previews"}
  #title
  Versioned previews

  #description
  Every branch renders at `/tree/branch`, every commit at `/blob/sha` with full navigation and search, skip new deploys.
  :::

  :::landing-feature-card{icon="i-lucide-panels-top-left" to="/writing/components"}
  #title
  Docs UI included

  #description
  Sidebar navigation, search (`⌘K`), table of contents, prev/next links, and a version history panel — built with Nuxt UI.
  :::

  :::landing-feature-card{icon="i-lucide-search" to="/writing/navigation"}
  #title
  SEO out of the box

  #description
  Sitemap, canonical URLs, OG images, and JSON-LD structured data, all generated from your content tree.
  :::

  :::landing-feature-card{icon="i-lucide-bot" to="/getting-started/introduction"}
  #title
  AI-native

  #description
  `llms.txt`, raw Markdown mirrors, an MCP server, Agent Skills discovery, and an optional "Ask AI" assistant.
  :::

  :::landing-feature-card{icon="i-lucide-message-square-text" to="/deployment/pr-preview-comments"}
  #title
  Review-friendly

  #description
  A GitHub Action comments on content PRs with instant preview links for every changed page.
  :::
::

::landing-faq
---
items:
  - label: Do I need to redeploy when content changes?
    content: No. Content is fetched from GitHub at request time and cached. A push to the production branch triggers a webhook that purges the changed pages — they're live within seconds, and the build is skipped entirely.
  - label: How do I preview a branch or a pull request?
    content: Any branch renders live at `/tree/branch-name`, any commit at `/blob/sha`, with that version's own navigation and search. An optional GitHub Action posts the links on pull requests.
  - label: Is it slow to parse Markdown on every request?
    content: Pages are parsed once per commit, not per request. Rendered HTML is ISR-cached at the edge and parsed content is cached by commit SHA, so warm pages are served without touching GitHub at all.
  - label: How do I install it?
    content: "It isn't on npm yet — install it from GitHub with `pnpm add comark-docs@github:comarkdown/comark-docs` and add `extends: ['comark-docs']` to your Nuxt config."
---
#headline
FAQ

#title
Frequently asked questions
::

::landing-cta
#title
Ready to ship docs faster?

#description
Install the layer, write Markdown in `content/`, and push. This site is the playground — everything you see here is built with it.

#links
  :::u-button
  ---
  to: /getting-started/installation
  size: lg
  trailing-icon: i-lucide-arrow-right
  ---
  Install comark-docs
  :::

  :::u-button
  ---
  to: https://github.com/comarkdown/comark-docs
  size: lg
  color: neutral
  variant: outline
  icon: i-simple-icons-github
  target: _blank
  ---
  Star on GitHub
  :::
::

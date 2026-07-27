---
title: A Nuxt layer for CMS-driven documentation
description: "comark-docs is a Nuxt layer for documentation sites powered by @comark/cms: Markdown served at request time, ISR-cached, revalidated on push."
navigation:
  title: Home
---

::page-hero
#title
Docs that ship without a redeploy.

#description
Write Markdown, push, done. Content is served at request time through [Comark CMS](https://cms.comark.dev), cached at the edge, and revalidated by a webhook.

#links
  :::button
  ---
  to: /getting-started/introduction
  size: lg
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::
::

::landing-features
#headline
Features

#title
Everything a docs site needs

#default
  :::landing-feature-card{icon="i-lucide-zap"}
  #title
  Instant content

  #description
  Content pushes go live in production without a redeploy.
  :::

  :::landing-feature-card{icon="i-lucide-git-branch"}
  #title
  Versioned previews

  #description
  Preview any branch at `/tree/branch` or commit at `/blob/sha`.
  :::

  :::landing-feature-card{icon="i-lucide-search"}
  #title
  SEO & AEO

  #description
  Sitemap, OG images, JSON-LD, llms.txt, RSS and MCP out of the box.
  :::
::

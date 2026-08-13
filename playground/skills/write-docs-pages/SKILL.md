---
name: write-docs-pages
description: >
  Author Markdown pages for a comark-docs site. Use when adding or editing
  content under content/, writing MDC, callouts, code blocks, or navigation YAML.
---

# Write docs pages

Pages live as Markdown under `content/`. Numeric prefixes order sections and files; they are stripped from the URL.

```
content/
├── index.md                          → /
├── 1.getting-started/
│   ├── .navigation.yml
│   ├── 1.introduction.md             → /getting-started/introduction
│   └── 2.installation.md             → /getting-started/installation
└── 2.concepts/
    └── 1.architecture.md             → /concepts/architecture
```

## Frontmatter

```md
---
title: Installation
description: Add the layer to a Nuxt app.
---
```

`description` is used in search, `llms.txt`, and OG images. Set `navigation: false` to hide a page from the sidebar (the landing page does this).

## MDC

Nuxt UI components in Markdown need the `u-` prefix (`::u-page-hero`, `:::u-button`). Layer extras used in these docs:

- `::note` / `::callout` — asides
- `::code-group` / `::code-preview` — tabbed and previewed code
- `::landing-features` / `:::landing-feature-card` — landing grid

Code fences support `{1-3}` line highlights and `[filename.ts]` labels. Mermaid fences render as diagrams.

See [Markdown](/getting-started/markdown) for the full syntax, and [references/page-skeleton.md](references/page-skeleton.md) for a starter page.

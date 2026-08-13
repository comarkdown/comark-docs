---
name: preview-versions
description: >
  Preview documentation at a branch or commit without changing production.
  Use when debugging content on /tree/:branch or /blob/:sha, or explaining
  how ISR and GitHub-pinned content work.
---

# Preview versions

Content is served at request time. Production is pinned to a commit SHA; any branch or commit can be previewed through versioned URLs.

| Mode | URL | Content |
| --- | --- | --- |
| prod | `/getting-started/introduction` | pinned production SHA |
| tree | `/tree/main/getting-started/introduction` | branch tip |
| blob | `/blob/<sha>/getting-started/introduction` | immutable commit |

Raw markdown mirrors exist at `/raw/**` (and under `/tree/.../raw/` / `/blob/.../raw/`).

Two cache tiers: ISR-cached page HTML at the edge, and a per-SHA runtime cache for parsed Markdown bodies. A GitHub push to the production branch hits `/api/revalidate` and purges ISR.

Keyboard shortcut `g` `h` toggles the version-history panel on a docs page.

Read more: [Architecture](/concepts/architecture).

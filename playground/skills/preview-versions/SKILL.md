---
name: preview-versions
description: >
  Preview documentation at a branch, commit or pull request without changing
  production. Use when debugging content on /tree/:branch, /blob/:sha or
  /pr/:number, or explaining how ISR and GitHub-pinned content work.
---

# Preview versions

Content is served at request time. Production is pinned to a commit SHA; any branch, commit or pull request can be previewed through versioned URLs.

| Mode | URL | Content |
| --- | --- | --- |
| prod | `/getting-started/introduction` | pinned production SHA |
| tree | `/tree/main/getting-started/introduction` | latest commit touching the content directory |
| blob | `/blob/<sha>/getting-started/introduction` | immutable commit |
| pr | `/pr/<number>/getting-started/introduction` | the PR's head commit (follows new pushes) |

Commit and PR previews are authorized: a `/blob/` SHA must be in production history or belong to a PR (same-repo, or a fork PR carrying the `preview:enabled` label), and `/pr/` applies the same rule. Unauthorized refs answer 404.

Raw markdown mirrors exist at `/raw/**` (and under `/tree/.../raw/` / `/blob/.../raw/`).

Two cache tiers: ISR-cached page HTML at the edge, and a per-parser-version, per-content-SHA runtime cache for parsed Markdown bodies. A GitHub push to the production branch hits `/api/revalidate` and purges ISR.

Keyboard shortcut `g` `h` toggles the version-history panel on a docs page.

Read more: [Architecture](/concepts/architecture), [Versioned previews](/concepts/versioned-previews).

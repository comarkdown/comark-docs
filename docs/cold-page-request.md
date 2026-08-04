# Cold page request

First visitor to a page after deploy or ISR cache expiry.

```mermaid
sequenceDiagram
  participant Browser
  participant Edge as Edge ISR
  participant SSR as Lambda SSR
  participant CMSRoute as /api/content/**
  participant Refs as Shared ref cache (content:refs)
  participant GH as GitHub
  participant CMS as shared cms

  Browser->>Edge: GET /docs/foo
  Edge-->>SSR: cache miss → render

  SSR->>CMSRoute: $fetch (navigation)
  CMSRoute->>CMS: getProdContent()
  CMS->>Refs: resolveSha(targetBranch)
  alt cache hit (within 60s TTL)
    Refs-->>CMS: cached sha
  else cache miss
    Refs->>GH: commits/<branch>
    GH-->>Refs: sha
    Refs-->>CMS: sha
  end
  CMS->>CMS: rebuild if sha advanced
  CMS->>GH: init partial (~36 files, at <sha>)
  CMSRoute-->>SSR: nav tree

  SSR->>CMSRoute: $fetch (page)
  CMSRoute->>CMS: getProdContent() (same sha → no rebuild)
  CMS->>GH: fetch + parse 1 page (at <sha>)
  CMSRoute-->>SSR: parsed page

  SSR-->>Edge: HTML
  Edge-->>Browser: HTML (cached for next visitor)
```

**Cost:** one shared-cache lookup for the branch tip + the instance builds its index
from GitHub once per head, then one page parse. All reads pinned to the immutable
`<sha>`.

The ref cache is shared across *instances*, so GitHub is hit once per 60s TTL window
rather than once per cold start. It is **not** shared across regions — Vercel's
Runtime Cache is regional (see the note on `refCacheDriver()` in
`server/utils/cache.ts`), so the ceiling is one GitHub call per region per window.
This project runs single-region, which is what makes that distinction academic today.

A ref that doesn't resolve is cached too, for the same window, but **only** when the
caller asks for it (`resolveSha(ref, { cacheMisses: true })`) — the public
`/tree/:branch` route does, so a nonexistent branch can't be replayed into one
GitHub API call per request. The production branch above deliberately does not:
GitHub answers 404 when a token loses access to a private repo, and caching that
would turn an expired token into a site-wide outage for the window rather than one
failed request.

**On a content push**, `server/api/revalidate.post.ts` writes the new SHA
directly into the same shared ref cache (`cacheSha()`) before fanning out ISR
purges for the affected pages, so a freshly-purged page's next render already
sees the new SHA instead of waiting out the 60s TTL.

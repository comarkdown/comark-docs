# Cold page request

First visitor to a page after deploy or ISR cache expiry.

```mermaid
sequenceDiagram
  participant Browser
  participant Edge as Edge ISR
  participant SSR as Lambda SSR
  participant CMSRoute as /api/cms/**
  participant Refs as Shared ref cache (cms:refs)
  participant GH as GitHub
  participant CMS as shared cms

  Browser->>Edge: GET /docs/foo
  Edge-->>SSR: cache miss → render

  SSR->>CMSRoute: $fetch (navigation)
  CMSRoute->>CMS: getProdCMS()
  CMS->>Refs: resolveSha(targetBranch)
  alt cache hit (within 60s TTL)
    Refs-->>CMS: cached sha
  else cache miss
    Refs->>GH: commits/<branch>
    GH-->>Refs: sha
    Refs-->>CMS: sha
  end
  CMS->>CMS: rebuild if sha advanced
  CMS->>GH: init metaOnly (~36 files, at <sha>)
  CMSRoute-->>SSR: nav tree

  SSR->>CMSRoute: $fetch (page)
  CMSRoute->>CMS: getProdCMS() (same sha → no rebuild)
  CMS->>GH: fetch + parse 1 page (at <sha>)
  CMSRoute-->>SSR: parsed page

  SSR-->>Edge: HTML
  Edge-->>Browser: HTML (cached for next visitor)
```

**Cost:** one shared-cache lookup for the branch tip (GitHub is only hit once per
60s TTL window across *all* instances/regions, not per instance) + the instance
builds its index from GitHub once per head, then one page parse. All reads
pinned to the immutable `<sha>`.

**On a content push**, `server/api/revalidate.post.ts` writes the new SHA
directly into the same shared ref cache (`cacheSha()`) before fanning out ISR
purges for the affected pages, so a freshly-purged page's next render already
sees the new SHA instead of waiting out the 60s TTL.

import type { RouterConfig } from '@nuxt/schema'

/**
 * Register the versioned preview routes (`/tree/:ref`, `/blob/:ref` and their
 * `/:slug(.+)` docs variants) as real routes that reuse the landing and docs
 * page components.
 *
 * They can't be `alias` entries on those pages: an alias may not introduce a
 * param (`:ref`) the canonical record lacks: Vue Router warns (R0102).
 *
 * Deliberate divergence from comark-cms: this file arrived there in comarkdown/comark-cms#79
 * and was reverted an hour later in #83, back to `alias` entries. The layer was
 * extracted at the commit in between and keeps this approach on purpose — the
 * warning R0102 emits is accurate, and an alias genuinely cannot add `:ref`. Don't
 * "resync" this away without a reason the revert didn't record.
 */
export default <RouterConfig>{
  routes: (routes) => {
    const landing = routes.find((r) => r.path === '/')
    const docs = routes.find((r) => r.path === '/:slug(.+)')

    const extra = []
    if (landing) {
      extra.push(
        { ...landing, name: 'landing-tree', path: '/tree/:ref' },
        { ...landing, name: 'landing-blob', path: '/blob/:ref' }
      )
    }
    if (docs) {
      extra.push(
        { ...docs, name: 'docs-tree', path: '/tree/:ref/:slug(.+)' },
        { ...docs, name: 'docs-blob', path: '/blob/:ref/:slug(.+)' }
      )
    }

    return [...routes, ...extra]
  },
}

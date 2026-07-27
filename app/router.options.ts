import type { RouterConfig } from '@nuxt/schema'

/**
 * Register the versioned preview routes (`/tree/:ref`, `/blob/:ref` and their
 * `/:slug(.+)` docs variants) as real routes that reuse the landing and docs
 * page components.
 *
 * They can't be `alias` entries on those pages: an alias may not introduce a
 * param (`:ref`) the canonical record lacks: Vue Router warns (R0102).
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

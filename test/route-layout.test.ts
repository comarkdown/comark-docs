import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import type { NavigationItem } from 'comark-content'
import routerOptions from '../app/router.options'
import { resolveRouteLayout } from '../app/utils/navigation'

const routes = [
  { name: 'index', path: '/', component: {} },
  { name: 'slug', path: '/:slug(.+)', component: {} },
  { name: 'custom', path: '/custom', component: {} },
]
const registeredRoutes = routerOptions.routes!(routes) ?? routes
function resolve(path: string) {
  const preview = path.match(/^\/(pr|blob|tree)\/[^/]+(\/.*)?$/)
  const name = preview
    ? `${preview[2] ? 'docs' : 'landing'}-${preview[1]}`
    : path === '/' ? 'index' : path === '/custom' ? 'custom' : 'slug'
  const matched = registeredRoutes.find(route => route.name === name)!
  expect(matched).toBeDefined()
  return { path, meta: matched.meta ?? {}, matched: [matched] } as RouteLocationNormalized
}

describe.each(['', '/pr/123', '/blob/abc1234', '/tree/feature%2Fdocs'])('route layout under %s', (base) => {
  const navigation = [
    { title: 'Guide', path: '/guide' },
    {
      title: 'Examples', path: '/examples', layout: 'page', page: false,
      children: [{ title: 'Overview', path: '/examples/overview' }],
    },
  ] as NavigationItem[]

  it('defaults docs pages to the docs layout', () => {
    expect(resolveRouteLayout(navigation, resolve(`${base}/guide`), '/guide')).toBe('docs')
  })

  it('defaults hidden pages and pages without navigation to docs', () => {
    expect(resolveRouteLayout(navigation, resolve(`${base}/hidden`), '/hidden')).toBe('docs')
    expect(resolveRouteLayout(null, resolve(`${base}/guide`), '/guide')).toBe('docs')
  })

  it('inherits explicit navigation layouts', () => {
    expect(resolveRouteLayout(navigation, resolve(`${base}/examples/overview`), '/examples/overview')).toBe('page')
  })

  it('leaves landing pages without a default layout', () => {
    expect(resolveRouteLayout(navigation, resolve(base || '/'), '/')).toBeUndefined()
  })

  it.each([false, 'page', 'docs'] as const)('honors route layout metadata %s', (layout) => {
    const route = resolve(`${base}/guide`)
    expect(resolveRouteLayout(navigation, { ...route, meta: { layout } }, '/guide')).toBe(layout || undefined)
  })
})

it('leaves custom routes without a default layout', () => {
  expect(resolveRouteLayout([], resolve('/custom'), '/custom')).toBeUndefined()
})

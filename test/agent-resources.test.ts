import { describe, expect, it } from 'vitest'
import { pageResourceUri, pageRouteFromUri } from '../server/utils/agent-resources'

describe('pageResourceUri', () => {
  it('prefixes a page route', () => {
    expect(pageResourceUri('/getting-started/installation')).toBe('docs://page/getting-started/installation')
    expect(pageResourceUri('getting-started/installation')).toBe('docs://page/getting-started/installation')
  })
})

describe('pageRouteFromUri', () => {
  it('returns the route of a page resource, from a string or a URL', () => {
    expect(pageRouteFromUri('docs://page/getting-started/installation')).toBe('/getting-started/installation')
    expect(pageRouteFromUri(new URL('docs://page/getting-started/installation'))).toBe('/getting-started/installation')
  })

  it('drops a query or hash', () => {
    expect(pageRouteFromUri('docs://page/syntax/markdown#lists')).toBe('/syntax/markdown')
    expect(pageRouteFromUri('docs://page/syntax/markdown?x=1')).toBe('/syntax/markdown')
  })

  it('rejects anything that is not a page resource', () => {
    expect(pageRouteFromUri('docs://page')).toBeNull()
    expect(pageRouteFromUri('docs://page/')).toBeNull()
    expect(pageRouteFromUri('docs://pages/syntax')).toBeNull()
    expect(pageRouteFromUri('https://comark.dev/raw/syntax/markdown.md')).toBeNull()
  })
})

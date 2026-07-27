import { withBase } from 'ufo'

/** Prefix a single internal link with the base according to mode (tree, blob, prod) */
export function prefixLink(to: string, base: string): string {
  return to.startsWith('/') ? withBase(to, base) : to
}

/**
 * Deep-clone a Comark node tree and prefix internal `to`/`href` attributes with the base according to mode (tree, blob, prod).
 */
export function prefixTreeLinks<T>(nodes: T[], base: string): T[] {
  if (!base) return nodes
  return nodes.map((node) => prefixNode(node, base)) as T[]
}

function prefixNode(node: unknown, base: string): unknown {
  if (!Array.isArray(node)) return node
  const [tag, attrs, ...children] = node
  let nextAttrs = attrs
  if (attrs && typeof attrs === 'object') {
    for (const key of ['to', 'href'] as const) {
      const value = (attrs as Record<string, unknown>)[key]
      if (typeof value === 'string' && value.startsWith('/')) {
        nextAttrs = { ...nextAttrs, [key]: withBase(value, base) }
      }
    }
  }
  return [tag, nextAttrs, ...children.map((child) => prefixNode(child, base))]
}

/** Deep-clone a navigation tree, prefixing every item `path` with the base according to mode (tree, blob, prod) */
export function prefixNavigation<T extends { path: string; children?: T[] }>(items: T[], base: string): T[] {
  if (!base) return items
  return items.map((item) => ({
    ...item,
    path: withBase(item.path, base),
    ...(item.children?.length ? { children: prefixNavigation(item.children, base) } : {}),
  }))
}

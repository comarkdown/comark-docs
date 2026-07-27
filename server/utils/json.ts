import type { CMSListFile } from '@comark/cms'

/** Deterministic JSON (sorted object keys) for stable equality checks. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`
}

/** Stable hash of a manifest item's visible metadata (its `data` — identity lives on `meta`). */
export function hashManifestItem(item: CMSListFile | undefined): string {
  if (!item) return ''
  return stableStringify(item.data ?? {})
}

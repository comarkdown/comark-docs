import type { ContentOptions } from 'comark-content'

export function extendContent(options: ContentOptions): ContentOptions {
  console.log('[playground] extendContent override applied, sources:', Object.keys(options.sources || {}))
  return options
}

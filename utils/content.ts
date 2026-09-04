import type { Tracer } from '@opentelemetry/api'
import { type ContentOptions, comarkContent } from 'comark-content'
import markdown from 'comark-content/plugins/markdown'
import yaml from 'comark-content/plugins/yaml'
import tracingOtel from 'comark-content/plugins/tracing/otel'
import rangi from 'comark/plugins/rangi'
import security from 'comark/plugins/security'
import emoji from 'comark/plugins/emoji'
import toc from 'comark/plugins/toc'
import mermaid from 'comark/plugins/mermaid'
import { geistTheme } from './geist.ts'
import { contentTracer } from '../server/utils/tracer.ts'

/** Frontmatter kept in the manifest, so `list()` and `navigation()` render without reading bodies. */
const LISTING_FIELDS = ['title', 'description', 'navigation', 'icon', 'layout']

// Bump CONTENT_PARSER_VERSION in `server/utils/cache.ts` when these plugins or their options change cached output.
const comarkPlugins = [
  mermaid({ theme: 'zinc-light', themeDark: 'zinc-dark' }),
  rangi({ theme: geistTheme }),
  toc({ depth: 3 }),
  emoji(),
  security({
    blockedTags: ['script', 'iframe', 'embed', 'form', 'base', 'meta', 'link', 'style'],
    allowDataImages: false,
  }),
]

/**
 * The parser, in one place for:
 * - The build-time seed
 * - The runtime instance
 */
function create(options: Pick<ContentOptions, 'source' | 'cache' | 'basePath'>, tracer?: Tracer) {
  return comarkContent({
    source: options.source,
    plugins: [
      markdown({
        comark: { plugins: comarkPlugins },
        listingFields: LISTING_FIELDS,
      }),
      yaml({ listingFields: LISTING_FIELDS }),
      tracer && tracingOtel({ tracer }),
    ],
    cache: options.cache,
    basePath: options.basePath,
  })
}

/** An instance serving requests: traced, and cached per content SHA. */
export function createRuntimeContentInstance(options: Pick<ContentOptions, 'source' | 'cache' | 'basePath'>) {
  return create(options, contentTracer())
}

/**
 * The throwaway instance the build-time seed is parsed with (`modules/snapshot/`).
 */
export function createBuildContentInstance(options: Pick<ContentOptions, 'source'>) {
  return create(options)
}

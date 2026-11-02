import type { Tracer } from '@opentelemetry/api'
import type { ComarkPlugin } from 'comark'
import { type ContentOptions, comarkContent } from 'comark-content'
import markdown from 'comark-content/plugins/markdown'
import yaml from 'comark-content/plugins/yaml'
import tracingOtel from 'comark-content/plugins/tracing/otel'
import security from 'comark/plugins/security'
import emoji from 'comark/plugins/emoji'
import toc from 'comark/plugins/toc'
import mermaid from 'comark/plugins/mermaid'
import { contentTracer } from '../server/utils/tracer.ts'

/** Frontmatter kept in the manifest, so `list()` and `navigation()` render without reading bodies. */
const LISTING_FIELDS = ['title', 'description', 'navigation', 'icon', 'layout']

// Bump CONTENT_PARSER_VERSION in `server/utils/cache.ts` when these plugins or their options change cached output.
// The highlighter is the site's choice (`comarkDocs.highlighter`), so it is passed in.
const comarkPlugins = (highlighter: ComarkPlugin) => [
  mermaid({ theme: 'zinc-light', themeDark: 'zinc-dark' }),
  highlighter,
  toc({ depth: 3 }),
  emoji(),
  security({
    blockedTags: ['script', 'iframe', 'embed', 'form', 'base', 'meta', 'link', 'style'],
    allowDataImages: false,
  }),
]

/**
 * The parser, in one place for:
 * - The build-time snapshot
 * - The runtime instance
 */
function create(options: Pick<ContentOptions, 'source' | 'cache' | 'basePath'>, highlighter: ComarkPlugin, tracer?: Tracer) {
  return comarkContent({
    source: options.source,
    plugins: [
      markdown({
        comark: { plugins: comarkPlugins(highlighter) },
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
export function createRuntimeContentInstance(
  options: Pick<ContentOptions, 'source' | 'cache' | 'basePath'>,
  highlighter: ComarkPlugin,
) {
  return create(options, highlighter, contentTracer())
}

/**
 * The throwaway instance the build-time snapshot is parsed with (`modules/snapshot/`).
 */
export function createBuildContentInstance(options: Pick<ContentOptions, 'source'>, highlighter: ComarkPlugin) {
  return create(options, highlighter)
}

import { AsyncLocalStorage } from 'node:async_hooks'
import { tracingChannel } from 'node:diagnostics_channel'
import { context, propagation, SpanStatusCode, trace, type Attributes, type Span } from '@opentelemetry/api'
import { contentTracer, ensureLocalTracer, localTraceEnabled, shutdownLocalTracer } from '../utils/tracer'
import { registerOTel } from '@vercel/otel'

/** Payloads Nuxt publishes on its `nuxt.*` channels (`tracingChannel: true`), plus the span we attach. */
interface NuxtTraceContext {
  span?: Span
  error?: unknown
  streaming?: boolean
  ssrContext?: { url?: string }
  islandContext?: { name?: string }
  key?: string
  functionName?: string
  plugin?: { name?: string }
  middleware?: { name?: string, global?: boolean }
  name?: string
}

/** Span name and attributes per channel. Names stay low-cardinality; request-specific values go in attributes. */
const NUXT_CHANNELS: Record<string, (ctx: NuxtTraceContext) => [name: string, attributes: Attributes]> = {
  'nuxt.render': (ctx) => ['nuxt.render', { 'url.path': ctx.ssrContext?.url, 'nuxt.render.streaming': ctx.streaming }],
  'nuxt.island': (ctx) => [`nuxt.island ${ctx.islandContext?.name ?? ''}`.trim(), { 'url.path': ctx.ssrContext?.url }],
  'nuxt.data': (ctx) => ['nuxt.data', { 'nuxt.data.key': ctx.key, 'nuxt.data.function': ctx.functionName }],
  'nuxt.plugin': (ctx) => [`nuxt.plugin ${ctx.plugin?.name ?? ''}`.trim(), {}],
  'nuxt.middleware': (ctx) => [`nuxt.middleware ${ctx.middleware?.name ?? ''}`.trim(), { 'nuxt.middleware.global': ctx.middleware?.global }],
  'nuxt.hook': (ctx) => [`nuxt.hook ${ctx.name}`, {}],
}

export default defineNitroPlugin((nitro) => {
  if (!import.meta.dev) {
    registerOTel({
      serviceName: 'comark-content',
    })
  } else {
    if (!localTraceEnabled()) return
    ensureLocalTracer()
    nitro.hooks.hook('close', () => shutdownLocalTracer())
  }

  const handler = nitro.h3App.handler
  nitro.h3App.handler = (event) => {
    const requestContext = propagation.extract(context.active(), getRequestHeaders(event))
    return context.with(requestContext, () => handler(event))
  }

  const tracer = contentTracer()
  if (!tracer) return

  // Nests `nuxt.*` spans in each other (plugins and data under `nuxt.render`). The OTel active context
  // can't be entered from a channel subscriber, so the root `nuxt.*` span parents to it instead.
  const activeSpan = new AsyncLocalStorage<Span>()
  const endSpan = ({ span, error }: NuxtTraceContext) => {
    if (!span) return
    if (error !== undefined) {
      span.recordException(error instanceof Error ? error : String(error))
      span.setStatus({ code: SpanStatusCode.ERROR })
    }
    span.end()
  }

  for (const [channelName, describe] of Object.entries(NUXT_CHANNELS)) {
    const channel = tracingChannel<NuxtTraceContext, Span>(channelName)
    // Runs synchronously in the caller, before the traced function, so the span exists while it runs.
    channel.start.bindStore(activeSpan, (ctx) => {
      const parent = activeSpan.getStore()
      const [name, attributes] = describe(ctx)
      ctx.span = tracer.startSpan(name, { attributes }, parent ? trace.setSpan(context.active(), parent) : context.active())
      return ctx.span
    })
    channel.subscribe({
      start() {},
      // A synchronous throw publishes `error` then `end`, and no `asyncEnd`.
      end(ctx) {
        if (ctx.error !== undefined) endSpan(ctx)
      },
      asyncStart() {},
      asyncEnd: endSpan,
      error() {},
    })
  }
})

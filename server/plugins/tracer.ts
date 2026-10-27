import { AsyncLocalStorage } from 'node:async_hooks'
import { tracingChannel } from 'node:diagnostics_channel'
import { context, propagation, SpanStatusCode, trace, type Span } from '@opentelemetry/api'
import { contentTracer, ensureLocalTracer, localTraceEnabled, shutdownLocalTracer } from '../utils/tracer'
import { registerOTel } from '@vercel/otel'

/** What Nuxt publishes on its `nuxt.*` channels (`tracingChannel: true`), plus the span we attach. */
interface NuxtTraceContext {
  span: Span
  error?: unknown
  key?: string
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

  // Nests data spans under `nuxt.render`, which itself parents to the request span.
  const parentSpan = new AsyncLocalStorage<Span>()
  for (const name of ['nuxt.render', 'nuxt.data']) {
    const channel = tracingChannel<NuxtTraceContext, Span>(name)
    channel.start.bindStore(parentSpan, (ctx) => {
      const parent = parentSpan.getStore()
      ctx.span = tracer.startSpan(ctx.key ? `${name} ${ctx.key}` : name, {}, parent ? trace.setSpan(context.active(), parent) : context.active())
      return ctx.span
    })
    channel.subscribe({
      start() {},
      asyncStart() {},
      error: ({ span, error }) => {
        span.recordException(error instanceof Error ? error : String(error))
        span.setStatus({ code: SpanStatusCode.ERROR })
      },
      // A synchronous throw skips `asyncEnd`.
      end: ({ span, error }) => error !== undefined && span.end(),
      asyncEnd: ({ span }) => span.end(),
    })
  }
})

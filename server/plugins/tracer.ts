import { context, propagation, SpanStatusCode } from '@opentelemetry/api'
import type { H3Event } from 'h3'
import {
  createRenderTrace,
  finishRenderSpan,
  getRenderTrace,
  startRenderSpan,
  type RenderTraceState,
} from '../../utils/render-trace'
import { contentTracer, ensureLocalTracer, localTraceEnabled, shutdownLocalTracer } from '../utils/tracer'
import { registerOTel } from '@vercel/otel'

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

  const startRequestTrace = (event: H3Event) => {
    const path = event.path
    const isPayload = /(?:^|\/)_payload\.json(?:\?|$)/.test(path)
    const state = createRenderTrace(event, isPayload)
    state.request = startRenderSpan(tracer, 'nitro:request', undefined, {
      'http.request.method': event.method,
      'url.path': path,
      'nuxt.render.payload': isPayload,
    })
    return state
  }

  nitro.hooks.hook('request', (event) => {
    const accept = getRequestHeader(event, 'accept') || ''
    const isPayload = /(?:^|\/)_payload\.json(?:\?|$)/.test(event.path)
    if (isPayload || accept.includes('text/html')) startRequestTrace(event)
  })

  nitro.hooks.hook('render:before', ({ event }) => {
    const state = getRenderTrace(event) || startRequestTrace(event)
    state.render = startRenderSpan(tracer, 'nuxt:render', state.request, {
      'nuxt.render.payload': state.isPayload,
      'nitro.cache.enabled': Boolean(event.context.cache),
    })
  })

  nitro.hooks.hook('render:route', ({ canStream, prefersStream }, { event }) => {
    const state = getRenderTrace(event)
    if (!state?.render) return
    state.vue = startRenderSpan(tracer, 'nuxt:render:vue', state.render, {
      'nuxt.render.can_stream': canStream,
      'nuxt.render.prefers_stream': prefersStream,
    })
  })

  nitro.hooks.hook('render:html', (_html, { event, streaming }) => {
    // Streaming calls this hook before Vue renders the body. ISR and payload
    // responses are buffered, which gives us the post-render boundary below.
    if (streaming) return
    const state = getRenderTrace(event)
    if (!state?.render) return
    finishRenderSpan(state, 'finalize')
    state.html = startRenderSpan(tracer, 'nuxt:render:html', state.render)
  })

  nitro.hooks.hook('render:response', (response, { event }) => {
    const state = getRenderTrace(event)
    if (!state) return

    finishRenderSpan(state, 'vue')
    finishRenderSpan(state, 'finalize')
    finishRenderSpan(state, 'html')
    if (response.statusCode) state.render?.setAttribute('http.response.status_code', response.statusCode)
    if (typeof response.body === 'string') {
      state.render?.setAttribute('http.response.body.size', new TextEncoder().encode(response.body).byteLength)
    }
    finishRenderSpan(state, 'render')
    state.response = startRenderSpan(tracer, 'nitro:response', state.request)
  })

  nitro.hooks.hook('afterResponse', (event) => {
    const state = getRenderTrace(event)
    if (!state) return
    finishRenderSpan(state, 'response')
    finishRenderSpan(state, 'request')
  })

  nitro.hooks.hook('error', (error, { event }) => {
    if (!event) return
    const state = getRenderTrace(event)
    if (!state) return
    markRenderTraceFailed(state, error)
  })
})

function markRenderTraceFailed(state: RenderTraceState, error: unknown): void {
  const exception = error instanceof Error ? error : String(error)
  for (const key of ['vue', 'finalize', 'html', 'render', 'response', 'request'] as const) {
    const span = state[key]
    if (!span) continue
    span.recordException(exception)
    span.setStatus({ code: SpanStatusCode.ERROR })
    finishRenderSpan(state, key)
  }
}

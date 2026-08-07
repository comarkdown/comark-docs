import { context, propagation } from '@opentelemetry/api'
import { ensureLocalTracer, localTraceEnabled, shutdownLocalTracer } from '../utils/tracer'
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
})

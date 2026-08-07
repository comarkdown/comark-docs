import { createRequire } from 'node:module'
import { trace, type Tracer } from '@opentelemetry/api'

const require = createRequire(import.meta.url)

declare global {

  var __comarkDocsLocalTracerReady: boolean | undefined
}

let localProvider: { shutdown(): Promise<void> } | undefined

/** Dev local OTLP — on when COMARK_LOCAL_TRACE=1 or standard OTEL_TRACES_EXPORTER=otlp. */
export function localTraceEnabled(): boolean {
  if (!import.meta.dev) return false
  if (process.env.COMARK_LOCAL_TRACE === '1') return true
  const exporter = process.env.OTEL_TRACES_EXPORTER?.trim()
  return exporter === 'otlp' || exporter === 'otlp/protobuf'
}

/** Register a Node OTel provider that exports to a local OTLP collector (Jaeger, etc.). */
export function ensureLocalTracer(): void {
  if (globalThis.__comarkDocsLocalTracerReady) return
  globalThis.__comarkDocsLocalTracerReady = true

  try {
    const { OTLPTraceExporter } =
      require('@opentelemetry/exporter-trace-otlp-proto') as typeof import('@opentelemetry/exporter-trace-otlp-proto')
    const { resourceFromAttributes } = require('@opentelemetry/resources') as typeof import('@opentelemetry/resources')
    const { NodeTracerProvider, BatchSpanProcessor } =
      require('@opentelemetry/sdk-trace-node') as typeof import('@opentelemetry/sdk-trace-node')

    // Honor OTEL_EXPORTER_OTLP_* / OTEL_EXPORTER_OTLP_TRACES_* env vars (no hardcoded URL).
    const exporter = new OTLPTraceExporter()
    const provider = new NodeTracerProvider({
      // Match `plugins/otel.ts`'s `registerOTel({ serviceName })` so dev and
      // production traces land under one service instead of splitting the timeline.
      resource: resourceFromAttributes({
        'service.name': process.env.OTEL_SERVICE_NAME ?? 'comark-content',
      }),
      // Batch, not Simple: a single `init()` ends ~180 spans, and SimpleSpanProcessor
      // exports each one in its own concurrent OTLP request. Collectors that assemble
      // traces per-request then drop most spans (and 500 under the concurrency), which
      // is why only the last-ended span of a subtree — `source:read`, `cache:get` —
      // showed up while `parse:*` and their parents vanished. Batching sends the whole
      // trace in one request.
      spanProcessors: [new BatchSpanProcessor(exporter, { maxExportBatchSize: 512, scheduledDelayMillis: 500 })],
    })

    provider.register()
    localProvider = provider
  } catch (err) {
    throw new Error(`Failed to register local tracer, please install the required dependencies: @opentelemetry/exporter-trace-otlp-proto @opentelemetry/resources @opentelemetry/sdk-trace-node`, { cause: err })
  }
}

export async function shutdownLocalTracer(): Promise<void> {
  await localProvider?.shutdown()
}

/** Tracer for comarkContent — local OTLP in dev, Vercel OTel in production. */
export function contentTracer(): Tracer | undefined {
  if (import.meta.dev) {
    if (!localTraceEnabled()) return undefined
    ensureLocalTracer()
    return trace.getTracer('comark-content')
  }
  // server/plugins/otel.ts registers @vercel/otel at Nitro startup, before any request.
  return trace.getTracer('comark-content')
}

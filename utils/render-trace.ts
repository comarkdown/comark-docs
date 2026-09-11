import { context, trace, type Attributes, type Span, type Tracer } from '@opentelemetry/api'
import type { H3Event } from 'h3'

export interface RenderTraceState {
  request?: Span
  render?: Span
  vue?: Span
  finalize?: Span
  html?: Span
  response?: Span
  isPayload: boolean
}

type TracedEventContext = H3Event['context'] & {
  _comarkRenderTrace?: RenderTraceState
}

export function getRenderTrace(event: H3Event): RenderTraceState | undefined {
  return (event.context as TracedEventContext)._comarkRenderTrace
}

export function createRenderTrace(event: H3Event, isPayload: boolean): RenderTraceState {
  const state = { isPayload }
  ;(event.context as TracedEventContext)._comarkRenderTrace = state
  return state
}

export function startRenderSpan(
  tracer: Tracer,
  name: string,
  parent?: Span,
  attributes?: Attributes
): Span {
  const parentContext = parent ? trace.setSpan(context.active(), parent) : context.active()
  return tracer.startSpan(name, { attributes }, parentContext)
}

export function finishRenderSpan(
  state: RenderTraceState,
  key: Exclude<keyof RenderTraceState, 'isPayload'>
): void {
  state[key]?.end()
  state[key] = undefined
}

import { trace } from '@opentelemetry/api'
import { finishRenderSpan, getRenderTrace, startRenderSpan } from '../../utils/render-trace'

export default defineNuxtPlugin({
  name: 'comark-render-tracer',
  enforce: 'pre',
  setup(nuxtApp) {
    const event = nuxtApp.ssrContext?.event
    if (!event) return

    const state = getRenderTrace(event)
    if (!state?.render) return

    nuxtApp.hook('app:rendered', () => {
      finishRenderSpan(state, 'vue')
      state.finalize = startRenderSpan(
        trace.getTracer('comark-content'),
        state.isPayload ? 'nuxt:render:payload' : 'nuxt:render:finalize',
        state.render
      )
    })
  },
})

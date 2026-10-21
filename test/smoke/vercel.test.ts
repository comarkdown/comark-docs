import { setTimeout as sleep } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { INTRO_PAGE, request } from '../e2e/utils'

const FROM_CACHE = /^(?:HIT|STALE|PRERENDER)$/

describe('ISR', () => {
  it('serves a repeat request from the cache', async () => {
    let cache: string | null = null
    // Vercel stores a fresh response about a second after serving it, so an immediate repeat still misses.
    for (let attempt = 0; attempt < 10 && !FROM_CACHE.test(cache ?? ''); attempt++) {
      if (attempt) await sleep(1000)
      const response = await request(INTRO_PAGE.path)
      expect(response.status).toBe(200)
      await response.text()
      cache = response.headers.get('x-vercel-cache')
    }
    expect(cache).toMatch(FROM_CACHE)
  })
})

// The push webhook only targets production.
describe.runIf(process.env.SMOKE_ENVIRONMENT === 'Production')('revalidation webhook', () => {
  it('refuses an unsigned call', async () => {
    const response = await request('/api/revalidate', { method: 'POST' })
    // A 501 means `WEBHOOK_SECRET` or `VERCEL_BYPASS_TOKEN` is missing from the deployment.
    expect(response.status).toBe(401)
  })
})

// Every run costs AI Gateway calls, so it is opt-in.
describe.runIf(process.env.SMOKE_ASSISTANT === 'true')('assistant', () => {
  it('streams an answer', async () => {
    const response = await request('/api/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: 'smoke', role: 'user', parts: [{ type: 'text', text: 'In one sentence, what is this documentation about?' }] }],
      }),
      signal: AbortSignal.timeout(55_000),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    const stream = await response.text()
    expect(stream).not.toContain('"type":"error"')
    expect(stream).toContain('"type":"text-delta"')
    expect(stream).toContain('"type":"finish"')
  })
})

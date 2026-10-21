import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import { expectSelfContainedBundle } from '../server-bundle'

const serverDir = fileURLToPath(new URL('../../playground/.output/server/', import.meta.url))

// A lazy chunk (a component, a route) only fails once requested, so the route crawl alone can miss it.
it('every import in the server bundle resolves inside the build output', async () => {
  await expectSelfContainedBundle(serverDir)
})

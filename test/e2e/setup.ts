import { type ChildProcess, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { type AddressInfo, createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    baseURL: string
  }
}

const entry = fileURLToPath(new URL('../../playground/.output/server/index.mjs', import.meta.url))

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo
      probe.close(() => resolve(port))
    })
  })
}

async function waitForServer(url: string, server: ChildProcess) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`The playground server exited with code ${server.exitCode}`)
    }
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error(`The playground server did not answer on ${url} within 30s`)
}

/** Boots the built playground once for the whole e2e project. */
export default async function setup(project: TestProject) {
  if (!existsSync(entry)) {
    throw new Error('No playground build found: run `pnpm build` before `pnpm test:e2e`.')
  }

  const port = await freePort()
  const server = spawn(process.execPath, [entry], {
    env: {
      NUXT_APP_SECRET: randomBytes(32).toString('base64'),
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    // Server logs land in the test output: the `[request error]` line is what explains a failing route.
    stdio: ['ignore', 'inherit', 'inherit'],
  })

  const baseURL = `http://127.0.0.1:${port}`
  try {
    await waitForServer(`${baseURL}/robots.txt`, server)
  } catch (error) {
    server.kill()
    throw error
  }
  project.provide('baseURL', baseURL)

  return () => {
    server.kill()
  }
}

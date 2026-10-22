import type { TestProject } from 'vitest/node'

/** Points the e2e suite at a deployment instead of booting the local build. */
export default function setup(project: TestProject) {
  const url = process.env.SMOKE_URL
  if (!url) {
    throw new Error('No deployment to test: set `SMOKE_URL`, e.g. `SMOKE_URL=https://docs-template.comark.dev pnpm test:smoke`.')
  }
  project.provide('baseURL', new URL(url).origin)
}

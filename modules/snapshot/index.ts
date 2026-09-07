import { mkdir } from 'node:fs/promises'
import { defineNuxtModule, useLogger } from '@nuxt/kit'
import { writeSnapshots } from 'comark-content'
import fs from 'comark-content/sources/fs'
import { join } from 'pathe'
import { createBuildContentInstance } from '../../utils/content'
import { resolveSnapshotSha } from './utils'

const logger = useLogger('comark-docs')

/** Where the snapshot lives in the build, and the server-asset namespace it is read back through. */
const ASSET_BASE = 'comark-content'

/**
 * Writes a build-time content snapshot into the function bundle.
 * A cold start then hydrates from it instead of walking the content repository.
 */
export default defineNuxtModule({
  meta: { name: 'comark-docs:snapshot' },
  setup(_options, nuxt) {
    // Do not run in dev or prepare.
    if (nuxt.options.dev || nuxt.options._prepare) return

    const dir = join(nuxt.options.buildDir, ASSET_BASE)

    nuxt.hook('modules:done', async () => {
      await mkdir(dir, { recursive: true })
      nuxt.options.nitro.serverAssets = [
        ...(nuxt.options.nitro.serverAssets ?? []),
        { baseName: ASSET_BASE, dir },
      ]
    })

    nuxt.hook('build:before', async () => {
      const { docs } = nuxt.options.runtimeConfig
      const { repoRoot, contentDir, contentPath, github } = docs

      const sha = await resolveSnapshotSha({
        repoRoot,
        contentDir,
        repo: `${github.owner}/${github.repo}`,
        token: docs.githubToken || process.env.NUXT_DOCS_GITHUB_TOKEN || process.env.GITHUB_TOKEN,
        warn: (message) => logger.warn(message),
      })
      if (!sha) {
        logger.warn(
          'No commit in this checkout could be confirmed to hold the content being built, ' +
            'so no snapshot is shipped: cold starts will walk the content repository.'
        )
        return
      }

      const content = createBuildContentInstance({ source: fs(contentPath) })

      try {
        await writeSnapshots(content, { dir: join(dir, sha), manifest: false })
        logger.success(`Content snapshot: ${sha.slice(0, 7)}`)
      } catch (error) {
        logger.warn('Could not write the content snapshot — cold starts will walk the content repository.', error)
      }
    })
  },
})

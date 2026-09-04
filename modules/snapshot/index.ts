import { cp, mkdir } from 'node:fs/promises'
import { defineNuxtModule, useLogger } from '@nuxt/kit'
import { writeSnapshots } from 'comark-content'
import fs from 'comark-content/sources/fs'
import { join } from 'pathe'
import { createBuildContentInstance } from '../../utils/content'
import { resolveSeedRefs } from './utils'
import { getPinnedSha } from '../../server/utils/global-config'

const logger = useLogger('comark-docs')

/** Where the seed lives in the build, and the server-asset namespace it is read back through. */
const ASSET_BASE = 'comark-content'

/**
 * Writes a build-time content seed into the function bundle, so a cold start hydrates from the generated snapshot.
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

      const refs = await resolveSeedRefs({
        repoRoot,
        contentDir,
        repo: `${github.owner}/${github.repo}`,
        token: docs.githubToken || process.env.GITHUB_TOKEN,
        pinnedSha: await getPinnedSha(),
        warn: (message) => logger.warn(message),
      })
      if (!refs.length) {
        logger.warn(
          'No commit in this checkout could be confirmed to hold the content being built, ' +
            'so no seed is shipped — cold starts will walk the content repository.'
        )
        return
      }

      // A throwaway instance over the local files, sharing the runtime's parser: a seed parsed by
      // a different plugin set is silently different content, not a cache miss.
      const content = createBuildContentInstance({ source: fs(contentPath) })

      try {
        const [primary, ...rest] = refs as [string, ...string[]]
        await writeSnapshots(content, { dir: join(dir, primary) })
        // Copied rather than re-written: `writeSnapshots()` reparses from the source each time, and
        // every ref here was verified to hold the same content anyway.
        for (const ref of rest) await cp(join(dir, primary), join(dir, ref), { recursive: true })

        logger.success(`Content seed: ${refs.map((ref) => ref.slice(0, 7)).join(', ')}`)
      } catch (error) {
        // Never fail the build over an optimization. An empty asset directory reads as "no seed"
        // and the deployment falls back to GitHub.
        logger.warn('Could not write the content seed — cold starts will walk the content repository.', error)
      }
    })
  },
})

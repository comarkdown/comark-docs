import { addPrerenderRoutes, addServerHandler, createResolver, defineNuxtModule, useLogger } from '@nuxt/kit'
import { defu } from 'defu'
import { join } from 'pathe'
import { scanSkills } from '../../utils/skills'
import type { ComarkDocsOptions } from '../config'

const logger = useLogger('comark-docs')

export default defineNuxtModule({
  meta: {
    name: 'comark-docs/skills',
  },
  async setup(_options, nuxt) {
    const comarkDocs = (nuxt.options as typeof nuxt.options & { comarkDocs?: ComarkDocsOptions }).comarkDocs
    const skillsDir = join(nuxt.options.rootDir, comarkDocs?.skills?.dir || 'skills')

    const { catalog, warnings } = await scanSkills(skillsDir)
    for (const warning of warnings) logger.warn(warning)
    if (!catalog.length) return

    logger.info(`Found ${catalog.length} agent skill${catalog.length > 1 ? 's' : ''}: ${catalog.map((s) => s.name).join(', ')}`)
    nuxt.options.runtimeConfig.skills = { catalog }

    const { resolve } = createResolver(import.meta.url)
    const handler = resolve('./runtime/server/routes/skills-files')

    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.serverAssets ||= []
      nitroConfig.serverAssets.push({ baseName: 'skills', dir: skillsDir })
    })

    const prerenderRoutes = ['/.well-known/skills', '/.well-known/skills/', '/.well-known/skills/index.json']
    for (const skill of catalog) {
      for (const file of skill.files) {
        prerenderRoutes.push(`/.well-known/skills/${skill.name}/${file}`)
      }
    }
    addPrerenderRoutes(prerenderRoutes)

    if (!nuxt.options.dev && comarkDocs?.isr !== false) {
      nuxt.options.routeRules = defu(nuxt.options.routeRules, {
        '/.well-known/skills/**': { isr: true },
      }) as typeof nuxt.options.routeRules
    }

    addServerHandler({ route: '/.well-known/skills', handler })
    addServerHandler({ route: '/.well-known/skills/**', handler })
  },
})

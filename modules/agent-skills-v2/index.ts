import { addPrerenderRoutes, addServerHandler, createResolver, defineNuxtModule, useLogger } from '@nuxt/kit'
import type { ModuleOptions as AgentDiscoveryOptions, SkillEntry } from 'nuxt-agent-discovery'
import { join } from 'pathe'
import { buildV2Catalog, type SkillV2Entry } from './utils'

const V2_PREFIX = '/.well-known/agent-skills'
const V2_INDEX = `${V2_PREFIX}/index.json`
const logger = useLogger('comark-docs')

interface SkillsRuntimeConfig {
  agentDiscoverySkills?: { skills: SkillEntry[] }
  agentDiscoverySkillsV2?: { skills: SkillV2Entry[] }
}

declare module '@nuxt/schema' {
  interface RuntimeConfig {
    agentDiscoverySkillsV2?: { skills: SkillV2Entry[] }
  }
}

/** Add the v0.2 discovery index alongside nuxt-agent-discovery's v0.1 routes. */
export default defineNuxtModule({
  meta: { name: 'comark-docs:agent-skills-v2' },
  async setup(_options, nuxt) {
    const runtimeConfig = nuxt.options.runtimeConfig as typeof nuxt.options.runtimeConfig & SkillsRuntimeConfig
    const skills = runtimeConfig.agentDiscoverySkills?.skills
    if (!skills?.length) return

    const agentDiscovery = (nuxt.options as typeof nuxt.options & { agentDiscovery?: AgentDiscoveryOptions }).agentDiscovery
    const configuredDir = typeof agentDiscovery?.skills === 'object' ? agentDiscovery.skills.dir : undefined
    const skillsDir = join(nuxt.options.rootDir, configuredDir || 'skills')

    runtimeConfig.agentDiscoverySkillsV2 = {
      skills: await buildV2Catalog(skillsDir, skills),
    }

    const { resolve } = createResolver(import.meta.url)
    const handler = resolve('./runtime/server/routes/index')
    addServerHandler({ route: V2_PREFIX, handler })
    addServerHandler({ route: `${V2_PREFIX}/`, handler })
    addServerHandler({ route: V2_INDEX, handler })

    // Match nuxt-agent-discovery's prerender policy. The explicit index path
    // avoids the file/directory collision caused by prerendering both roots.
    const llms = (nuxt.options as typeof nuxt.options & { llms?: { prerender?: boolean } }).llms
    const staticBuild = Boolean((nuxt.options as typeof nuxt.options & { _generate?: boolean })._generate)
    if (staticBuild || llms?.prerender !== false) {
      addPrerenderRoutes(V2_INDEX)
    }

    nuxt.hook('agent-discovery:extend', ({ links }) => {
      links.push({
        href: V2_INDEX,
        rel: 'index',
        type: 'application/json',
        title: 'Agent skills index (v0.2): every skill published by this site',
      })
    })

    logger.info(`Published Agent Skills v0.2 index for ${skills.length} skill${skills.length > 1 ? 's' : ''}`)
  },
})

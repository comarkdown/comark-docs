import { defineEventHandler, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { AGENT_SKILLS_V2_SCHEMA, type SkillV2Catalog } from '../../../utils'

/** Serve the v0.2 catalog assembled from the validated v0.1 skill metadata. */
export default defineEventHandler((event) => {
  const { skills } = useRuntimeConfig(event).agentDiscoverySkillsV2 as unknown as SkillV2Catalog

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')

  return { $schema: AGENT_SKILLS_V2_SCHEMA, skills }
})

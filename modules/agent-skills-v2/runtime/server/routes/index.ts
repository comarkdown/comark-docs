import { defineEventHandler, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { AGENT_SKILLS_V2_SCHEMA, type SkillV2Entry } from '../../../utils'

export default defineEventHandler((event) => {
  const { skills } = useRuntimeConfig(event).agentDiscoverySkillsV2 as { skills: SkillV2Entry[] }

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')

  return { $schema: AGENT_SKILLS_V2_SCHEMA, skills }
})

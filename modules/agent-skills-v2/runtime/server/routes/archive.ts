import { createError, defineEventHandler, getRequestURL, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { AGENT_SKILLS_V2_PREFIX, type SkillV2Catalog } from '../../../utils'

/** Serve one generated archive after confirming that the v0.2 catalog advertises it. */
export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const { skills, archives } = useRuntimeConfig(event).agentDiscoverySkillsV2 as unknown as SkillV2Catalog
  const skill = skills.find(entry => entry.type === 'archive' && entry.url === pathname)
  if (!skill) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const archiveName = pathname.slice(AGENT_SKILLS_V2_PREFIX.length)
  const encoded = archives[archiveName]
  if (!encoded) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  setResponseHeader(event, 'Content-Type', 'application/gzip')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${archiveName}"`)
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return Buffer.from(encoded, 'base64')
})

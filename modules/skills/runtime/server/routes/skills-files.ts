import { resolveSkillFilePath, V2_SCHEMA, type SkillEntry } from '../../../utils'

const V1_PREFIX = '/.well-known/skills/'
const V2_PREFIX = '/.well-known/agent-skills/'
const CONTENT_TYPES: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.sh': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
}

function contentType(path: string): string {
  const dot = path.lastIndexOf('.')
  return (dot === -1 ? undefined : CONTENT_TYPES[path.slice(dot)]) || 'application/octet-stream'
}

function relativePath(pathname: string, prefix: string): string {
  const idx = pathname.indexOf(prefix)
  return idx === -1 ? '' : decodeURIComponent(pathname.slice(idx + prefix.length))
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const v2 = url.pathname === '/.well-known/agent-skills' || url.pathname.startsWith(V2_PREFIX)
  const filePath = relativePath(url.pathname, v2 ? V2_PREFIX : V1_PREFIX)
  const { skills } = useRuntimeConfig(event)

  if (!filePath || filePath === 'index.json') {
    setHeader(event, 'content-type', 'application/json')
    setHeader(event, 'cache-control', 'public, max-age=3600')
    return v2 ? { $schema: V2_SCHEMA, skills: skills.v2 } : { skills: skills.catalog }
  }

  const resolved = resolveSkillFilePath(filePath)
  if (!resolved) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  const skill = (skills.catalog as SkillEntry[]).find((entry) => entry.name === resolved.skillName)
  if (!skill || !skill.files.includes(resolved.relativeFile)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const storagePath = `${resolved.skillName}/${resolved.relativeFile}`
  const content = await useStorage('assets:skills').getItemRaw(storagePath)
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  setHeader(event, 'content-type', contentType(storagePath))
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return content
})

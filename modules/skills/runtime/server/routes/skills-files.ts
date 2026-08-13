import { resolveSkillFilePath, type SkillEntry } from '../../../../../utils/skills'

const PREFIX = '/.well-known/skills/'
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

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const idx = url.pathname.indexOf(PREFIX)
  const filePath = idx === -1 ? '' : decodeURIComponent(url.pathname.slice(idx + PREFIX.length))
  const { skills } = useRuntimeConfig(event)

  if (!filePath || filePath === 'index.json') {
    setHeader(event, 'content-type', 'application/json')
    setHeader(event, 'cache-control', 'public, max-age=3600')
    return { skills: skills.catalog }
  }

  const resolved = resolveSkillFilePath(filePath)
  if (!resolved) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  const catalog = skills.catalog as SkillEntry[]
  const skill = catalog.find((entry) => entry.name === resolved.skillName)
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

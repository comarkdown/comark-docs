import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, normalize } from 'pathe'
import { parse as parseYaml } from 'yaml'

export interface SkillEntry {
  name: string
  description: string
  files: string[]
}

export interface SkillV2Entry {
  name: string
  type: 'skill-md'
  description: string
  url: string
  digest: string
}

export interface ScanSkillsResult {
  catalog: SkillEntry[]
  warnings: string[]
}

export const V2_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json'

const SKILL_NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const MAX_NAME_LENGTH = 64

function skillNameError(name: string, dirName: string): string | null {
  if (name.length > MAX_NAME_LENGTH) return `Skill "${name}" exceeds ${MAX_NAME_LENGTH} character limit`
  if (!SKILL_NAME_REGEX.test(name) || name.includes('--')) {
    return `Skill name "${name}" does not match the Agent Skills naming spec`
  }
  if (name !== dirName) return `Skill name "${name}" does not match directory name "${dirName}"`
  return null
}

function parseSkillFrontmatter(content: string): { name?: string; description?: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match?.[1]) return null
  try {
    const parsed = parseYaml(match[1])
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const record = parsed as Record<string, unknown>
    return {
      name: typeof record.name === 'string' ? record.name : undefined,
      description: typeof record.description === 'string' ? record.description : undefined,
    }
  } catch {
    return null
  }
}

/** Normalise a `/.well-known/skills/` relative path into `{skill}/{file}`. */
export function resolveSkillFilePath(filePath: string): { skillName: string; relativeFile: string } | null {
  if (!filePath || filePath.includes('\0')) return null
  const n = normalize(filePath.replace(/\\/g, '/'))
  if (!n || isAbsolute(n) || n === '..' || n.startsWith('../')) return null
  const i = n.indexOf('/')
  if (i <= 0 || i === n.length - 1) return null
  return { skillName: n.slice(0, i), relativeFile: n.slice(i + 1) }
}

async function listFilesRecursively(dir: string, base = ''): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
    const relPath = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await listFilesRecursively(join(dir, entry.name), relPath)))
    else if (entry.isFile()) files.push(relPath)
  }
  return files
}

/** Scan a `skills/` directory and return a discovery catalog (v0.1 `.well-known/skills` shape). */
export async function scanSkills(skillsDir: string): Promise<ScanSkillsResult> {
  const catalog: SkillEntry[] = []
  const warnings: string[] = []

  const rootStat = await stat(skillsDir).catch(() => null)
  if (!rootStat?.isDirectory()) return { catalog, warnings }

  for (const entry of await readdir(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue

    const skillDir = join(skillsDir, entry.name)
    const skillMdPath = join(skillDir, 'SKILL.md')
    const mdStat = await lstat(skillMdPath).catch(() => null)
    if (!mdStat) continue
    if (!mdStat.isFile()) {
      warnings.push(`Skipping skill "${entry.name}": SKILL.md is not a file`)
      continue
    }

    let content: string
    try {
      content = await readFile(skillMdPath, 'utf-8')
    } catch {
      warnings.push(`Skipping skill "${entry.name}": could not read SKILL.md`)
      continue
    }

    const frontmatter = parseSkillFrontmatter(content)
    if (!frontmatter?.description?.trim()) {
      warnings.push(`Skipping skill "${entry.name}": missing description in SKILL.md frontmatter`)
      continue
    }

    const name = frontmatter.name || entry.name
    const nameError = skillNameError(name, entry.name)
    if (nameError) {
      warnings.push(nameError)
      continue
    }

    const files = await listFilesRecursively(skillDir)
    catalog.push({
      name,
      description: frontmatter.description,
      files: ['SKILL.md', ...files.filter((f) => f !== 'SKILL.md').sort()],
    })
  }

  catalog.sort((a, b) => a.name.localeCompare(b.name))
  return { catalog, warnings }
}

export function sha256Digest(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

/** v0.2 index entries: `skill-md` pointing at `SKILL.md`, with a SHA-256 digest of that file. */
export async function buildV2Catalog(skillsDir: string, catalog: SkillEntry[]): Promise<SkillV2Entry[]> {
  return Promise.all(
    catalog.map(async (skill) => {
      const bytes = await readFile(join(skillsDir, skill.name, 'SKILL.md'))
      return {
        name: skill.name,
        type: 'skill-md' as const,
        description: skill.description,
        url: `/.well-known/agent-skills/${skill.name}/SKILL.md`,
        digest: sha256Digest(bytes),
      }
    })
  )
}

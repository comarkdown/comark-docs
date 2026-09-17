import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import type { SkillEntry } from 'nuxt-agent-discovery'
import { join } from 'pathe'
import { create as createTar } from 'tar'

export const AGENT_SKILLS_V2_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json'
export const AGENT_SKILLS_V1_PREFIX = '/.well-known/skills/'
export const AGENT_SKILLS_V2_PREFIX = '/.well-known/agent-skills/'

interface SkillV2EntryBase {
  name: string
  description: string
  url: string
  digest: string
}

export interface SkillMdV2Entry extends SkillV2EntryBase {
  type: 'skill-md'
}

export interface SkillArchiveV2Entry extends SkillV2EntryBase {
  type: 'archive'
}

export type SkillV2Entry = SkillMdV2Entry | SkillArchiveV2Entry

export interface SkillV2Catalog {
  skills: SkillV2Entry[]
  archives: Record<string, string>
}

/** Return the RFC-formatted SHA-256 digest of an artifact's raw bytes. */
export function sha256Digest(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

/** Build v0.2 entries from the catalog already validated by nuxt-agent-discovery. */
export async function buildV2Catalog(
  skillsDir: string,
  archivesDir: string,
  skills: SkillEntry[]
): Promise<SkillV2Catalog> {
  await mkdir(archivesDir, { recursive: true })
  const archives: Record<string, string> = {}

  const entries = await Promise.all(skills.map(async (skill) => {
    const skillDir = join(skillsDir, skill.name)

    if (skill.files.length === 1 && skill.files[0] === 'SKILL.md') {
      const bytes = await readFile(join(skillDir, 'SKILL.md'))
      return {
        name: skill.name,
        type: 'skill-md' as const,
        description: skill.description,
        // The v0.2 RFC allows an artifact URL anywhere on the same origin. Reuse
        // the file route owned by nuxt-agent-discovery instead of serving it twice.
        url: `${AGENT_SKILLS_V1_PREFIX}${skill.name}/SKILL.md`,
        digest: sha256Digest(bytes),
      }
    }

    const archiveName = `${skill.name}.tar.gz`
    const archivePath = join(archivesDir, archiveName)
    await createTar({
      cwd: skillDir,
      file: archivePath,
      gzip: true,
      noMtime: true,
      portable: true,
    }, [...skill.files].sort())
    const bytes = await readFile(archivePath)
    archives[archiveName] = bytes.toString('base64')

    return {
      name: skill.name,
      type: 'archive' as const,
      description: skill.description,
      url: `${AGENT_SKILLS_V2_PREFIX}${archiveName}`,
      digest: sha256Digest(bytes),
    }
  }))

  return { skills: entries, archives }
}

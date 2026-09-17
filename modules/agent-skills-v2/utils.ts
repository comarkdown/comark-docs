import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { SkillEntry } from 'nuxt-agent-discovery'
import { join } from 'pathe'

export const AGENT_SKILLS_V2_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json'
export const AGENT_SKILLS_V1_PREFIX = '/.well-known/skills/'

export interface SkillV2Entry {
  name: string
  type: 'skill-md'
  description: string
  url: string
  digest: string
}

export function sha256Digest(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

/** Build v0.2 entries from the catalog already validated by nuxt-agent-discovery. */
export async function buildV2Catalog(skillsDir: string, skills: SkillEntry[]): Promise<SkillV2Entry[]> {
  return Promise.all(skills.map(async (skill) => {
    const bytes = await readFile(join(skillsDir, skill.name, 'SKILL.md'))
    return {
      name: skill.name,
      type: 'skill-md' as const,
      description: skill.description,
      // The v0.2 RFC allows an artifact URL anywhere on the same origin. Reuse
      // the file route owned by nuxt-agent-discovery instead of serving it twice.
      url: `${AGENT_SKILLS_V1_PREFIX}${skill.name}/SKILL.md`,
      digest: sha256Digest(bytes),
    }
  }))
}

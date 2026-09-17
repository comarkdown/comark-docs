import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type { SkillEntry } from 'nuxt-agent-discovery'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { AGENT_SKILLS_V1_PREFIX, buildV2Catalog, sha256Digest } from '../utils'

describe('buildV2Catalog', () => {
  it('points at the v0.1 artifact route and hashes the raw SKILL.md bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'comark-skills-v2-'))
    const skillMd = '---\nname: write-docs\ndescription: Write documentation.\n---\n\n# Write docs\n'
    await mkdir(join(root, 'write-docs'), { recursive: true })
    await writeFile(join(root, 'write-docs', 'SKILL.md'), skillMd)

    const skills: SkillEntry[] = [{
      name: 'write-docs',
      description: 'Write documentation.',
      files: ['SKILL.md', 'references/style.md'],
    }]

    const catalog = await buildV2Catalog(root, skills)
    const bytes = await readFile(join(root, 'write-docs', 'SKILL.md'))

    expect(catalog).toEqual([{
      name: 'write-docs',
      type: 'skill-md',
      description: 'Write documentation.',
      url: `${AGENT_SKILLS_V1_PREFIX}write-docs/SKILL.md`,
      digest: sha256Digest(bytes),
    }])
  })
})

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type { SkillEntry } from 'nuxt-agent-discovery'
import { join } from 'pathe'
import { list as listTar } from 'tar'
import { describe, expect, it } from 'vitest'
import { AGENT_SKILLS_V1_PREFIX, AGENT_SKILLS_V2_PREFIX, buildV2Catalog, sha256Digest } from '../utils'

describe('buildV2Catalog', () => {
  it('uses skill-md for a single file and an archive for supporting files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'comark-skills-v2-'))
    const archives = join(root, 'archives')
    const simpleMd = '---\nname: simple\ndescription: A simple skill.\n---\n'
    const bundledMd = '---\nname: bundled\ndescription: A bundled skill.\n---\n'
    await mkdir(join(root, 'simple'), { recursive: true })
    await writeFile(join(root, 'simple', 'SKILL.md'), simpleMd)
    await mkdir(join(root, 'bundled', 'references'), { recursive: true })
    await writeFile(join(root, 'bundled', 'SKILL.md'), bundledMd)
    await writeFile(join(root, 'bundled', 'references', 'style.md'), '# Style\n')

    const skills: SkillEntry[] = [
      { name: 'simple', description: 'A simple skill.', files: ['SKILL.md'] },
      { name: 'bundled', description: 'A bundled skill.', files: ['SKILL.md', 'references/style.md'] },
    ]

    const catalog = await buildV2Catalog(root, archives, skills)
    const simpleBytes = await readFile(join(root, 'simple', 'SKILL.md'))
    const archivePath = join(archives, 'bundled.tar.gz')
    const archiveBytes = await readFile(archivePath)
    const archiveEntries: string[] = []
    await listTar({ file: archivePath, onReadEntry: entry => archiveEntries.push(entry.path) })

    expect(catalog.skills).toEqual([
      {
        name: 'simple',
        type: 'skill-md',
        description: 'A simple skill.',
        url: `${AGENT_SKILLS_V1_PREFIX}simple/SKILL.md`,
        digest: sha256Digest(simpleBytes),
      },
      {
        name: 'bundled',
        type: 'archive',
        description: 'A bundled skill.',
        url: `${AGENT_SKILLS_V2_PREFIX}bundled.tar.gz`,
        digest: sha256Digest(archiveBytes),
      },
    ])
    expect(Buffer.from(catalog.archives['bundled.tar.gz'], 'base64')).toEqual(archiveBytes)
    expect(archiveEntries).toEqual(['SKILL.md', 'references/style.md'])

    const repeated = await buildV2Catalog(root, join(root, 'archives-repeated'), skills)
    expect(repeated).toEqual(catalog)
  })
})

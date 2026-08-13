import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { resolveSkillFilePath, scanSkills } from '../utils'

async function skillsRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'comark-skills-'))
}

async function writeSkill(root: string, name: string, skillMd: string, extra: Record<string, string> = {}) {
  const dir = join(root, name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), skillMd)
  for (const [rel, body] of Object.entries(extra)) {
    const path = join(dir, rel)
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, body)
  }
}

describe('scanSkills', () => {
  it('catalogues a valid skill with supporting files, SKILL.md first', async () => {
    const root = await skillsRoot()
    await writeSkill(
      root,
      'my-product',
      '---\nname: my-product\ndescription: >\n  Build apps with My Product.\n---\n',
      {
        'references/api.md': '# API\n',
        'scripts/setup.sh': '#!/bin/sh\n',
      }
    )

    const { catalog, warnings } = await scanSkills(root)
    expect(warnings).toEqual([])
    expect(catalog).toEqual([
      {
        name: 'my-product',
        description: 'Build apps with My Product.\n',
        files: ['SKILL.md', 'references/api.md', 'scripts/setup.sh'],
      },
    ])
  })

  it('defaults name to the directory when frontmatter omits it', async () => {
    const root = await skillsRoot()
    await writeSkill(root, 'create-project', '---\ndescription: Scaffold a project.\n---\n')
    expect((await scanSkills(root)).catalog[0]?.name).toBe('create-project')
  })

  it('skips skills without a description, with an invalid name, or with a name/dir mismatch', async () => {
    const root = await skillsRoot()
    await writeSkill(root, 'no-desc', '---\nname: no-desc\n---\n')
    await writeSkill(root, 'BadName', '---\nname: BadName\ndescription: Nope.\n---\n')
    await writeSkill(root, 'mismatch', '---\nname: other\ndescription: Nope.\n---\n')
    await writeSkill(root, 'ok-skill', '---\ndescription: Fine.\n---\n')

    const { catalog, warnings } = await scanSkills(root)
    expect(catalog.map((s) => s.name)).toEqual(['ok-skill'])
    expect(warnings).toHaveLength(3)
  })

  it('omits hidden files from the catalog', async () => {
    const root = await skillsRoot()
    await writeSkill(root, 'my-skill', '---\ndescription: Hidden files stay private.\n---\n', {
      '.secret': 'nope',
      'refs/.cache': 'nope',
    })
    expect((await scanSkills(root)).catalog[0]?.files).toEqual(['SKILL.md'])
  })

  it('returns an empty catalog when the directory is missing', async () => {
    expect(await scanSkills(join(tmpdir(), 'comark-skills-missing'))).toEqual({
      catalog: [],
      warnings: [],
    })
  })

  it('skips a skill whose SKILL.md is a directory, without aborting the scan', async () => {
    const root = await skillsRoot()
    await mkdir(join(root, 'broken', 'SKILL.md'), { recursive: true })
    await writeSkill(root, 'ok-skill', '---\ndescription: Fine.\n---\n')

    const { catalog, warnings } = await scanSkills(root)
    expect(catalog.map((s) => s.name)).toEqual(['ok-skill'])
    expect(warnings.some((w) => w.includes('broken') && w.includes('not a file'))).toBe(true)
  })

  it('does not list a symlink that points outside the skill directory', async () => {
    const root = await skillsRoot()
    const outside = await mkdtemp(join(tmpdir(), 'comark-skills-outside-'))
    await writeFile(join(outside, 'secret.md'), 'leaked')
    await writeSkill(root, 'my-skill', '---\ndescription: Fine.\n---\n', {
      'references/api.md': '# API\n',
    })
    await symlink(join(outside, 'secret.md'), join(root, 'my-skill', 'leaked.md'))
    await symlink(outside, join(root, 'my-skill', 'escape'))

    expect((await scanSkills(root)).catalog[0]?.files).toEqual(['SKILL.md', 'references/api.md'])
  })
})

describe('resolveSkillFilePath', () => {
  it('normalises in-skill `.` / `..` segments', () => {
    expect(resolveSkillFilePath('my-skill/refs/../SKILL.md')).toEqual({
      skillName: 'my-skill',
      relativeFile: 'SKILL.md',
    })
    expect(resolveSkillFilePath('my-skill/./references/api.md')).toEqual({
      skillName: 'my-skill',
      relativeFile: 'references/api.md',
    })
  })

  it('rejects paths that escape or have no file', () => {
    expect(resolveSkillFilePath('../etc/passwd')).toBeNull()
    expect(resolveSkillFilePath('my-skill/../../etc/passwd')).toBeNull()
    expect(resolveSkillFilePath('/etc/passwd')).toBeNull()
    expect(resolveSkillFilePath('my-skill/SKILL.md\0.png')).toBeNull()
    expect(resolveSkillFilePath('my-skill')).toBeNull()
    expect(resolveSkillFilePath('')).toBeNull()
  })
})

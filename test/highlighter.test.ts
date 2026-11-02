import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import type { ComarkPlugin } from 'comark'
import fsSource from 'comark-content/sources/fs'
import { createBuildContentInstance } from '../utils/factory'
import defaultHighlighter from '../utils/highlighter'

async function parse(highlighter: ComarkPlugin) {
  const dir = await mkdtemp(join(tmpdir(), 'comark-docs-highlighter-'))
  await writeFile(join(dir, 'index.md'), '```ts\nconst answer = 42\n```\n')
  return JSON.stringify(await createBuildContentInstance({ source: fsSource(dir) }, highlighter).get('/'))
}

// `comarkDocs.highlighter` replaces rangi: the plugin a site passes runs, and the default one doesn't.
it('highlights code blocks with the highlighter it is given', async () => {
  const marker: ComarkPlugin = {
    name: 'test-highlighter',
    post({ tree }) {
      const mark = (node: unknown) => {
        if (!Array.isArray(node)) return
        if (node[0] === 'pre') node[1] = { ...node[1], highlightedBy: 'test' }
        node.slice(2).forEach(mark)
      }
      tree.nodes.forEach(mark)
    },
  }
  const custom = await parse(marker)
  expect(custom).toContain('"highlightedBy":"test"')
  expect(custom).not.toContain('#c41562')

  // Geist's keyword color, so the default is rangi with the layer's theme.
  expect(await parse(defaultHighlighter)).toContain('#c41562')
})

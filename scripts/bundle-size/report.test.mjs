import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, test } from 'vitest'
import { buildSnapshot, compareSnapshots, initialAssetPaths, validateSnapshot } from './report.mjs'

const temporaryDirectories = []
const servers = []

afterAll(async () => {
  await Promise.all(temporaryDirectories.map(directory => rm(directory, { force: true, recursive: true })))
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))))
})

/** Serves `pages` (route → status and HTML) like the running build, 404 for any other route. */
async function servePages(pages) {
  const server = createServer((request, response) => {
    const page = pages[new URL(request.url, 'http://localhost').pathname] ?? { status: 404, html: 'Not found' }
    response.writeHead(page.status, { 'content-type': 'text/html' })
    response.end(page.html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  return `http://127.0.0.1:${server.address().port}`
}

async function createBuild() {
  const root = await mkdtemp(join(tmpdir(), 'nuxt-bundle-size-'))
  temporaryDirectories.push(root)

  const assetDir = join(root, '.output/public/_nuxt')
  const analyzePath = join(root, '.nuxt/analyze/client.json')
  await mkdir(assetDir, { recursive: true })
  await mkdir(join(root, '.nuxt/analyze'), { recursive: true })
  await writeFile(join(assetDir, 'entry.js'), 'console.log("entry")')
  await writeFile(join(assetDir, 'entry.css'), 'body { color: green }')
  await writeFile(join(assetDir, 'entry.js.map'), '{}')
  await writeFile(join(assetDir, 'chunk.js'), 'export const chunk = 1')
  await writeFile(join(assetDir, 'lazy.js'), 'export const lazy = 1')
  await writeFile(analyzePath, JSON.stringify({
    nodeParts: {
      part: {
        renderedLength: 100,
        gzipLength: 80,
        brotliLength: 60
      }
    },
    nodeMetas: {
      module: {
        id: join(root, 'node_modules/example/index.js'),
        moduleParts: { 'entry.js': 'part' }
      }
    }
  }))
  return { root, analyzePath }
}

test('builds and compares production bundle snapshots', async () => {
  const { root, analyzePath } = await createBuild()
  // `/writing/components` is left out: a page the build no longer has is skipped, not an error.
  const url = await servePages({
    '/': {
      status: 200,
      html: [
        '<link rel="stylesheet" href="/_nuxt/entry.css" crossorigin>',
        '<link rel="modulepreload" as="script" crossorigin href="/_nuxt/entry.js">',
        '<link rel="modulepreload" as="script" crossorigin href=\'/_nuxt/chunk.js?v=1\'>',
        '<link rel="prefetch" as="script" crossorigin href="/_nuxt/lazy.js">',
        '<link rel="modulepreload" href="https://cdn.example/_nuxt/missing.js">',
        '<script type="module" src="/_nuxt/entry.js" crossorigin></script>'
      ].join('\n')
    },
    '/getting-started/introduction': { status: 200, html: '<script type="module" src="/_nuxt/entry.js"></script>' }
  })

  const base = await buildSnapshot({ root, analyzePath, url, label: 'base', sha: 'a'.repeat(40) })
  const head = structuredClone(base)
  head.label = 'pr'
  head.sha = 'b'.repeat(40)
  head.totals.javascript.brotli += 10
  head.totals.javascript.gzip += 12
  head.totals.all.brotli += 10
  head.totals.all.gzip += 12
  head.modules['node_modules/example/index.js'].brotli += 10
  head.routes['/'].javascript.brotli += 10
  head.routes['/'].files += 1

  assert.equal(base.schemaVersion, 3)
  assert.equal(base.assets, undefined)
  assert.equal(base.modules['node_modules/example/index.js'].brotli, 60)

  // Entry is deduplicated, prefetched and unknown assets are skipped.
  assert.deepEqual(Object.keys(base.routes), ['/', '/getting-started/introduction'])
  assert.equal(base.routes['/'].files, 3)
  assert.equal(base.routes['/'].javascript.raw, 'console.log("entry")'.length + 'export const chunk = 1'.length)
  assert.equal(base.routes['/'].css.raw, 'body { color: green }'.length)
  assert.equal(base.routes['/getting-started/introduction'].files, 1)

  const report = compareSnapshots(base, head)
  assert.match(report, /Client JavaScript/)
  assert.match(report, /Largest module increases/)
  assert.match(report, /report-only/)
  assert.match(report, /\| <code>\/<\/code> \| .+ \| \+10 B \(.+\) \| — \| \+1 \|/)
  assert.ok(report.indexOf('### Initial page load') < report.indexOf('### All client assets'))
})

test('fails the snapshot when a page errors', async () => {
  const { root, analyzePath } = await createBuild()
  const url = await servePages({ '/': { status: 500, html: 'Server error' } })

  await assert.rejects(
    buildSnapshot({ root, analyzePath, url, label: 'base', sha: 'a'.repeat(40) }),
    /\/ returned 500/
  )
})

test('extracts upfront assets from server-rendered HTML', () => {
  const paths = initialAssetPaths([
    '<LINK REL="stylesheet" HREF="/base/_nuxt/a.css">',
    '<link href=/_nuxt/b.js rel=modulepreload>',
    '<link rel="preload" as="fetch" href="/_payload.json">',
    '<script src="/_nuxt/legacy.js"></script>',
    '<script type="module" src="/_nuxt/c.js#hash"></script>'
  ].join(''))
  assert.deepEqual([...paths], ['_nuxt/a.css', '_nuxt/b.js', '_nuxt/c.js'])
})

test('validates snapshots and safely renders module identifiers', () => {
  const size = { raw: 1, gzip: 1, brotli: 1 }
  const totals = {
    javascript: { ...size },
    css: { raw: 0, gzip: 0, brotli: 0 },
    other: { raw: 0, gzip: 0, brotli: 0 },
    all: { ...size }
  }
  const base = {
    schemaVersion: 3,
    label: 'base',
    sha: 'a'.repeat(40),
    totals,
    routes: {},
    modules: {}
  }
  const head = {
    schemaVersion: 3,
    label: 'pr',
    sha: 'b'.repeat(40),
    totals,
    routes: {
      '/': { javascript: { ...size }, css: { ...size }, files: 1 },
      // Not in ROUTES: a PR measuring a new page still gets its row.
      '/blog': { javascript: { ...size }, css: { ...size }, files: 1 }
    },
    modules: {
      '`</code>|@nuxt<img src=x>`': size,
      '[click me](https://evil.example/)': size
    }
  }

  const report = compareSnapshots(base, head, { baseSha: base.sha, headSha: head.sha })
  assert.doesNotMatch(report, /@nuxt|<img|\[click me\]/)
  assert.match(report, /&#96;&lt;\/code&gt;&#124;&#64;nuxt&lt;img src=x&gt;&#96;/)
  assert.match(report, /&#91;click me&#93;\(https:\/\/evil\.example\/\)/)
  assert.match(report, /\| <code>\/<\/code> \| n\/a \| 1 B \| n\/a \| n\/a \| n\/a \|/)
  assert.match(report, /\| <code>\/blog<\/code> \| n\/a \| 1 B \| n\/a \| n\/a \| n\/a \|/)
  assert.ok(report.indexOf('<code>/</code>') < report.indexOf('<code>/blog</code>'))

  for (const route of ['/<img src=x>', '/a|b', '/[x](y)', 'blog', `/${'a'.repeat(256)}`, '/blog\n', '/blog\r\n', '/blog ']) {
    assert.throws(
      () => validateSnapshot({ ...head, routes: { [route]: head.routes['/'] } }, { label: 'pr' }),
      /invalid route/
    )
  }
  assert.throws(
    () => validateSnapshot({ ...head, routes: { '/': { ...head.routes['/'], files: 1.5 } } }, { label: 'pr' }),
    /files must be an integer/
  )
  assert.throws(
    () => validateSnapshot({ ...base, schemaVersion: 1 }, { label: 'base' }),
    /Unsupported snapshot schema version/
  )
  assert.throws(
    () => compareSnapshots(base, head, { baseSha: base.sha, headSha: 'c'.repeat(40) }),
    /snapshot SHA does not match/
  )
})

test('reports PR-only module identifiers inherited by ordinary objects', () => {
  const emptyTotals = {
    javascript: { raw: 0, gzip: 0, brotli: 0 },
    css: { raw: 0, gzip: 0, brotli: 0 },
    other: { raw: 0, gzip: 0, brotli: 0 },
    all: { raw: 0, gzip: 0, brotli: 0 }
  }
  const base = {
    schemaVersion: 3,
    label: 'base',
    sha: 'a'.repeat(40),
    totals: emptyTotals,
    routes: {},
    modules: {}
  }
  const head = {
    schemaVersion: 3,
    label: 'pr',
    sha: 'b'.repeat(40),
    totals: emptyTotals,
    routes: {},
    modules: {
      constructor: { raw: 3, gzip: 2, brotli: 1 }
    }
  }

  const report = compareSnapshots(base, head)
  assert.match(report, /<code>constructor<\/code> \| 0 B \| 1 B \| \+1 B/)
  assert.doesNotMatch(report, /Initial page load/)
})

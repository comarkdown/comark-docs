import { describe, expect, it } from 'vitest'
import { parseMarkdown } from 'comark'
import rangi from 'comark/plugins/rangi'
import { geistDark, geistLight, geistTheme } from '../utils/geist-theme'

describe('Geist syntax theme', () => {
  it('uses the live Geist light syntax roles', () => {
    expect(geistLight).toMatchObject({
      bg: '#fff',
      fg: '#171717',
      tokens: {
        kwd: '#c41562',
        oper: '#171717',
        func: '#7c00c9',
        cmnt: '#4d4d4d',
        bracket: '#171717',
        num: '#0064e2',
        var: '#a64f00',
        str: '#107d32',
      },
    })
  })

  it('uses legible dark-mode roles rather than the light blue token', () => {
    expect(geistDark).toMatchObject({
      bg: '#000',
      fg: '#ededed',
      tokens: {
        kwd: '#ff518d',
        oper: '#ededed',
        func: '#c472fb',
        cmnt: '#a0a0a0',
        bracket: '#ededed',
        num: '#50a8ff',
        var: '#f90',
        str: '#00ca52',
      },
    })
  })

  it('exports the same pair used by content and landing-page renderers', () => {
    expect(geistTheme).toEqual({ light: geistLight, dark: geistDark })
  })

  it('emits matching light and dark colors in highlighted markup', async () => {
    const document = await parseMarkdown('```ts\nconst answer = 42\nconst message = "yes" // note\n```', {
      plugins: [rangi({ theme: geistTheme })],
    })
    const markup = JSON.stringify(document.nodes)

    expect(markup).toContain('color:#c41562;--shiki-dark:#ff518d')
    expect(markup).toContain('color:#0064e2;--shiki-dark:#50a8ff')
    expect(markup).toContain('color:#107d32;--shiki-dark:#00ca52')
    expect(markup).toContain('color:#4d4d4d;--shiki-dark:#a0a0a0')
  })
})

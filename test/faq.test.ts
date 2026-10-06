import { describe, expect, it } from 'vitest'
import type { Node } from 'comark'
import { extractFaq } from '../app/utils/faq'

const accordion = (...items: Array<[string, ...Node[]]>): Node =>
  ['accordion', {}, ...items.map(([label, ...children]) => ['accordion-item', { label }, ...children] as Node)] as Node

describe('extractFaq', () => {
  it('reads the accordion under a FAQ heading', () => {
    const nodes: Node[] = [
      ['h2', { id: 'intro' }, 'Intro'],
      ['p', {}, 'Some text.'],
      ['h2', { id: 'faq' }, 'FAQ'],
      accordion(
        ['Is it free?', ['p', {}, 'Yes. MIT ', ['strong', {}, 'licensed'], '.']],
        ['Does it stream?', ['p', {}, 'Yes.'], ['p', {}, 'See ', ['code', {}, 'autoClose'], '.']]
      ),
    ]
    expect(extractFaq(nodes)).toEqual([
      { question: 'Is it free?', answer: 'Yes. MIT licensed.' },
      { question: 'Does it stream?', answer: 'Yes. See autoClose.' },
    ])
  })

  it('keeps inline children of an unwrapped answer together', () => {
    const nodes: Node[] = [
      ['h2', {}, 'FAQ'],
      accordion(['Drop-in?', 'No. The syntax differs (', ['code', {}, '::alert'], ' instead of ', ['code', {}, '<Alert>'], ').']),
    ]
    expect(extractFaq(nodes)).toEqual([{ question: 'Drop-in?', answer: 'No. The syntax differs (::alert instead of <Alert>).' }])
  })

  it('accepts "Frequently asked questions" in any case', () => {
    const nodes: Node[] = [['h2', {}, 'Frequently Asked Questions'], accordion(['Q?', ['p', {}, 'A.']])]
    expect(extractFaq(nodes)).toEqual([{ question: 'Q?', answer: 'A.' }])
  })

  it('ignores accordions outside the FAQ section', () => {
    const nodes: Node[] = [
      accordion(['Before?', ['p', {}, 'No.']]),
      ['h2', {}, 'FAQ'],
      ['h3', {}, 'General'],
      accordion(['Inside?', ['p', {}, 'Yes.']]),
      ['h2', {}, 'Next section'],
      accordion(['After?', ['p', {}, 'No.']]),
    ]
    expect(extractFaq(nodes)).toEqual([{ question: 'Inside?', answer: 'Yes.' }])
  })

  it('separates block elements and drops comments', () => {
    const nodes: Node[] = [
      ['h2', {}, 'FAQ'],
      accordion(['Which?', ['ul', {}, ['li', {}, 'One'], ['li', {}, 'Two']], [null, {}, ' hidden '] as unknown as Node]),
    ]
    expect(extractFaq(nodes)).toEqual([{ question: 'Which?', answer: 'One Two' }])
  })

  it('skips items without a label or an answer', () => {
    const nodes: Node[] = [
      ['h2', {}, 'FAQ'],
      ['accordion', {}, ['accordion-item', {}, ['p', {}, 'No label']], ['accordion-item', { label: 'Empty?' }]] as Node,
    ]
    expect(extractFaq(nodes)).toEqual([])
    expect(extractFaq(undefined)).toEqual([])
  })
})

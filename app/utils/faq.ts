import type { Node } from 'comark'

export interface FaqEntry {
  question: string
  answer: string
}

const FAQ_HEADING = /^(?:faqs?|frequently asked questions)$/i

/**
 * The questions of a page's FAQ, for FAQPage structured data: every `accordion-item` of an `accordion`
 * placed under a top-level heading named "FAQ" (or "Frequently asked questions"), up to the next heading
 * of the same level. The item `label` is the question and its text content the answer.
 */
export function extractFaq(nodes: Node[] | undefined): FaqEntry[] {
  const entries: FaqEntry[] = []
  let faqLevel = 0

  for (const node of nodes ?? []) {
    if (!Array.isArray(node) || typeof node[0] !== 'string') continue
    const tag = node[0]

    const level = /^h([1-6])$/.exec(tag)?.[1]
    if (level) {
      const depth = Number(level)
      if (FAQ_HEADING.test(plainText(node).trim())) faqLevel = depth
      else if (faqLevel && depth <= faqLevel) faqLevel = 0
      continue
    }

    if (!faqLevel || tag !== 'accordion') continue
    for (const item of node.slice(2) as Node[]) {
      if (!Array.isArray(item) || item[0] !== 'accordion-item') continue
      const question = typeof item[1]?.label === 'string' ? item[1].label.trim() : ''
      const answer = (item.slice(2) as Node[]).map(plainText).join('').replace(/\s+/g, ' ').trim()
      if (question && answer) entries.push({ question, answer })
    }
  }

  return entries
}

const BLOCK_TAGS = new Set(['p', 'li', 'ul', 'ol', 'pre', 'blockquote', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** Text of a node, without comments. Block elements are padded so their text does not run together. */
function plainText(node: Node): string {
  if (typeof node === 'string') return node
  if (node[0] === null) return ''
  const text = (node.slice(2) as Node[]).map(plainText).join('')
  return BLOCK_TAGS.has(node[0]) ? ` ${text} ` : text
}

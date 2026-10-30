// @ts-check
/**
 * The components Markdown can use: the `components` maps of `app/pages/[...slug].vue` and
 * `app/pages/index.vue`, in kebab case and without the `Prose` prefix, as the renderer resolves them.
 * `lint.mjs` lints sites against it.
 */
export const components = [
  // Docs pages
  'a', 'accordion', 'accordion-item', 'badge', 'blockquote', 'callout', 'card', 'card-group',
  'caution', 'code', 'code-collapse', 'code-group', 'code-icon', 'code-preview', 'code-tree',
  'collapsible', 'em', 'field', 'field-group', 'h1', 'h2', 'h3', 'h4', 'hr', 'icon', 'img', 'kbd',
  'li', 'note', 'ol', 'p', 'pre', 'prompt', 'script', 'steps', 'strong', 'table', 'tabs',
  'tabs-item', 'tbody', 'td', 'th', 'thead', 'tip', 'tr', 'ul', 'warning', 'mermaid',
  'code-explorer', 'browser',
  // Landing page
  'landing-hero', 'landing-stack', 'landing-tabs', 'landing-features', 'landing-feature-card',
  'landing-faq', 'landing-cta', 'landing-hero-demo', 'button',
]

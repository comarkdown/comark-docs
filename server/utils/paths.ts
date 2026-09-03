/** Repo-relative content prefix (e.g. `docs/content/`), derived at build time by modules/config.ts. */
export function contentPrefix(): string {
  return `${useRuntimeConfig().docs.contentDir.replace(/\/$/, '')}/`
}

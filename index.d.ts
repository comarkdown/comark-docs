import type { ComarkDocsOptions } from './modules/config'

declare module '@nuxt/schema' {
  interface NuxtConfig {
    comarkDocs?: ComarkDocsOptions
  }
  interface NuxtOptions {
    comarkDocs?: ComarkDocsOptions
  }
}

declare module 'nuxt/schema' {
  interface NuxtConfig {
    comarkDocs?: ComarkDocsOptions
  }
  interface NuxtOptions {
    comarkDocs?: ComarkDocsOptions
  }
  interface RuntimeConfig {
    docs: {
      githubToken: string
      webhookSecret: string
      bypassToken: string
      github: {
        owner: string
        repo: string
        branch: string
      }
      contentDir: string
      contentPath: string
      repoRoot: string
      codeExplorer: {
        allowRepos: string[]
      }
    }
  }
}

export type { ComarkDocsOptions }

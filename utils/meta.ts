import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import { withHttps } from 'ufo'

/** Infer the public site URL from the deployment platform env. */
export function inferSiteURL(): string | undefined {
  // https://github.com/unjs/std-env/issues/59
  const url =
    process.env.NUXT_PUBLIC_SITE_URL ||
    process.env.NUXT_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_BRANCH_URL ||
    process.env.VERCEL_URL ||
    process.env.URL || // Netlify
    process.env.CI_PAGES_URL || // GitLab Pages
    process.env.CF_PAGES_URL // Cloudflare Pages

  return url ? withHttps(url) : undefined
}

export async function getPackageJsonMetadata(dir: string): Promise<{ name?: string; description?: string }> {
  try {
    const parsed = JSON.parse(await readFile(resolve(dir, 'package.json'), 'utf-8'))
    return { name: parsed.name, description: parsed.description }
  } catch {
    return {}
  }
}

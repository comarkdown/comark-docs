import type { NavigationItem } from '@comark/cms'

/** Sitemap source for `@nuxtjs/sitemap`. */
export default defineEventHandler(async () => {
  const cms = await getProdCMS()
  const navigation = await cms.navigation()

  const urls: string[] = ['/', '/logos']
  const collect = (items: NavigationItem[]) => {
    for (const item of items) {
      if (item.page !== false && item.path) urls.push(item.path)
      if (item.children?.length) collect(item.children)
    }
  }
  collect(navigation)

  return [...new Set(urls)].map((loc) => ({ loc }))
})

import { defineCMSClientPlugin } from '@comark/cms/client'
import { joinURL } from 'ufo'

/** One search entry per document heading — consumed by `UContentSearch`. */
export interface SearchSection {
  id: string
  title: string
  titles: string[]
  level: number
  content: string
}

interface SearchSectionsClientMethods {
  searchSections(): Promise<SearchSection[]>
}

/**
 * Client half of the custom `search-sections` serve handler ( in `server/utils/cms.ts`).
 *
 * Adds `cms.searchSections()` to the CMS client.
 */
export const searchSectionsClient = defineCMSClientPlugin<Record<string, never>, SearchSectionsClientMethods>(() => ({
  name: 'search-sections',
  setup: ({ options }) => ({
    searchSections: () => options.fetch<SearchSection[]>(joinURL(options.baseURL, options.basePath, 'search-sections')),
  }),
}))

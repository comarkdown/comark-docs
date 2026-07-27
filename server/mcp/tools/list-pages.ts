import type { NavigationItem } from '@comark/cms'

export default defineMcpTool({
  description:
    'List every page of the documentation with its path, title, and description. Use get-page to read a page.',
  handler: async () => {
    const cms = await getProdCMS()
    const navigation = await cms.navigation()

    const lines: string[] = []
    const collect = (items: NavigationItem[], section?: string) => {
      for (const item of items) {
        if (item.page !== false && item.path) {
          lines.push(
            `${item.path} — ${item.title}${item.description ? `: ${item.description}` : ''}${section ? ` (${section})` : ''}`
          )
        }
        if (item.children?.length) collect(item.children, section ?? item.title)
      }
    }
    collect(navigation)

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    }
  },
})

export const extendContent = defineDocsExtendContent((options) => {
  console.log('[playground] extendContent override applied, sources:', Object.keys(options.sources || {}))
  return options
})

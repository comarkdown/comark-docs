/** Shared open state for the right-side version-history panel (off by default). */
export function useVersionHistory() {
  return useState<boolean>('version-history-open', () => false)
}

/** Shared open state for the Ask AI assistant panel (off by default). */
export function useAssistant() {
  return useState<boolean>('assistant-open', () => false)
}

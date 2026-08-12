<script setup lang="ts">
import shiki from '@comark/nuxt/plugins/shiki'

const props = defineProps<{
  /** Markdown source: shown highlighted in the source tab, rendered live in the output tab. */
  source: string
  /** Optional URL for the "Open in playground" header button. */
  playground?: string
}>()

const plugins = [shiki()]

// Four-backtick fence so fenced code blocks inside the demo source don't close it early.
const sourceAsCode = computed(() => ['````md', props.source, '````'].join('\n'))

const tabs = [
  { id: 'source', label: 'source.md', icon: 'i-custom-comark' },
  { id: 'output', label: 'preview', icon: 'i-lucide-eye' },
]
const activeIndex = ref(0)

/** Stable, unique per instance so `aria-controls`/`aria-labelledby` can pair up. */
const uid = useId()
const tabId = (index: number) => `${uid}-tab-${index}`
const panelId = (index: number) => `${uid}-panel-${index}`

const tabRefs = useTemplateRef<HTMLButtonElement[]>('tabRefs')

function select(index: number) {
  const next = (index + tabs.length) % tabs.length
  activeIndex.value = next
  tabRefs.value?.[next]?.focus()
}

function onKeydown(event: KeyboardEvent) {
  const handlers: Record<string, () => void> = {
    ArrowRight: () => select(activeIndex.value + 1),
    ArrowLeft: () => select(activeIndex.value - 1),
    Home: () => select(0),
    End: () => select(tabs.length - 1),
  }
  const handler = handlers[event.key]
  if (!handler) return
  event.preventDefault()
  handler()
}
</script>

<template>
  <div class="not-prose overflow-hidden rounded-lg border border-muted bg-default text-left">
    <div class="flex items-center justify-between gap-4 border-b border-muted bg-elevated/50 px-3 py-2">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex shrink-0 gap-1.5">
          <div class="size-2.5 rounded-full bg-accented" />
          <div class="size-2.5 rounded-full bg-accented" />
          <div class="size-2.5 rounded-full bg-accented" />
        </div>

        <div
          role="tablist"
          aria-label="Markdown demo"
          class="flex items-center gap-1"
          @keydown="onKeydown"
        >
          <button
            v-for="(tab, index) in tabs"
            :id="tabId(index)"
            :key="tab.id"
            ref="tabRefs"
            role="tab"
            :aria-selected="activeIndex === index"
            :aria-controls="panelId(index)"
            :tabindex="activeIndex === index ? 0 : -1"
            class="flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs transition-colors"
            :class="activeIndex === index ? 'bg-accented/60 text-highlighted' : 'text-muted hover:text-highlighted'"
            @click="select(index)"
          >
            <UIcon
              :name="tab.icon"
              class="size-3.5 shrink-0"
            />
            {{ tab.label }}
          </button>
        </div>
      </div>

      <UButton
        v-if="playground"
        label="Open in playground"
        trailing-icon="i-lucide-arrow-right"
        variant="subtle"
        color="neutral"
        size="xs"
        :to="playground"
      />
    </div>

    <div
      v-show="activeIndex === 0"
      :id="panelId(0)"
      role="tabpanel"
      :aria-labelledby="tabId(0)"
      class="hero-demo-source h-80 overflow-y-auto p-4 md:h-96"
    >
      <Markdown
        class="font-mono text-sm/6"
        :value="sourceAsCode"
        :plugins="plugins"
        :components="{ pre: 'pre' }"
      />
    </div>

    <div
      v-show="activeIndex === 1"
      :id="panelId(1)"
      role="tabpanel"
      :aria-labelledby="tabId(1)"
      class="h-80 overflow-y-auto p-4 text-sm md:h-96"
    >
      <Markdown
        :value="source"
        :plugins="plugins"
      />
    </div>
  </div>
</template>

<style scoped>
.hero-demo-source :deep(pre) {
  margin: 0;
  background: transparent !important;
  white-space: pre-wrap;
  word-break: break-word;
}

.hero-demo-source :deep(.line) {
  display: inline;
}

.hero-demo-source :deep(span) {
  background-color: transparent !important;
}
</style>

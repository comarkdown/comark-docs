<script setup lang="ts">
interface Tab {
  icon?: string
  title: string
  description?: string
}

const props = defineProps<{
  items: Tab[]
}>()

const activeIndex = ref(0)

/** Stable, unique per instance so `aria-controls`/`aria-labelledby` can pair up. */
const uid = useId()
const tabId = (index: number) => `${uid}-tab-${index}`
const panelId = (index: number) => `${uid}-panel-${index}`

const tabs = useTemplateRef<HTMLButtonElement[]>('tabs')

/**
 * Roving tabindex: the tablist is one stop, arrows move between tabs. Selection
 * follows focus (automatic activation), which is the recommended pattern when
 * showing a panel is cheap: every panel is already rendered here.
 */
function select(index: number) {
  const next = (index + props.items.length) % props.items.length
  activeIndex.value = next
  tabs.value?.[next]?.focus()
}

function onKeydown(event: KeyboardEvent) {
  const handlers: Record<string, () => void> = {
    ArrowDown: () => select(activeIndex.value + 1),
    ArrowRight: () => select(activeIndex.value + 1),
    ArrowUp: () => select(activeIndex.value - 1),
    ArrowLeft: () => select(activeIndex.value - 1),
    Home: () => select(0),
    End: () => select(props.items.length - 1),
  }
  const handler = handlers[event.key]
  if (!handler) return
  event.preventDefault()
  handler()
}
</script>

<template>
  <UPageSection
    :ui="{
      container: 'max-w-6xl py-16 sm:py-16 lg:py-16',
    }"
  >
    <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-end">
      <div class="space-y-10">
        <div>
          <p
            v-if="$slots.headline"
            class="font-mono font-medium text-xs text-primary uppercase tracking-[0.12em]"
          >
            // <slot name="headline" /> //
          </p>
          <h2
            v-if="$slots.title"
            class="mt-6 text-3xl sm:text-4xl font-medium tracking-tight leading-tight text-highlighted"
          >
            <slot
              name="title"
              unwrap="p"
            />
          </h2>
          <p
            v-if="$slots.description"
            class="mt-4 text-base toned max-w-lg"
          >
            <slot
              name="description"
              unwrap="p"
            />
          </p>
        </div>

        <!--
          A real tablist: one tab stop, arrow keys to move. Note there is no
          `@mouseenter`: switching the panel on hover meant a pointer merely
          crossing the list silently replaced the content the reader was looking at.
        -->
        <div
          role="tablist"
          aria-orientation="vertical"
          class="space-y-2"
          @keydown="onKeydown"
        >
          <button
            v-for="(item, i) in items"
            :id="tabId(i)"
            :key="item.title"
            ref="tabs"
            type="button"
            role="tab"
            :aria-selected="activeIndex === i"
            :aria-controls="panelId(i)"
            :tabindex="activeIndex === i ? 0 : -1"
            class="w-full flex gap-4 p-4 rounded-xl border text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="activeIndex === i ? 'bg-elevated/50 border-muted' : 'hover:bg-elevated/50 border-transparent'"
            @click="activeIndex = i"
          >
            <span
              v-if="item.icon"
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated"
            >
              <UIcon
                :name="item.icon"
                class="size-5 text-primary"
              />
            </span>
            <div>
              <h3 class="text-sm font-medium tracking-tight text-highlighted">
                {{ item.title }}
              </h3>
              <p
                v-if="item.description"
                class="mt-1 text-sm leading-relaxed text-toned"
              >
                {{ item.description }}
              </p>
            </div>
          </button>
        </div>
      </div>

      <div class="relative rounded-2xl overflow-hidden">
        <div
          v-for="(_, i) in items"
          v-show="activeIndex === i"
          :id="panelId(i)"
          :key="i"
          role="tabpanel"
          :aria-labelledby="tabId(i)"
          :tabindex="0"
        >
          <slot :name="`code-${i}`" />
        </div>
      </div>
    </div>
  </UPageSection>
</template>

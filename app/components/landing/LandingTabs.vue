<script setup lang="ts">
interface Tab {
  icon?: string
  title: string
  description?: string
}

const props = withDefaults(defineProps<{
  items: Tab[]
  reverse?: boolean | string
  /**
   * Where the headline, title and description go: `side` stacks them above the
   * tab list in its column; `center` and `left` put them above both columns,
   * centered or left-aligned.
   */
  header?: 'side' | 'center' | 'left'
}>(), {
  reverse: false,
  header: 'side',
})

const reversed = computed(() => props.reverse === true || props.reverse === 'true' || props.reverse === '')
const stacked = computed(() => props.header !== 'side')

/**
 * One grid for every layout: the header, tab list and panel are its items. On
 * the side layout, the panel spans both rows of the other column, and the
 * shorter column sits at the bottom; stacked, the header spans both columns
 * and the tab list and panel are top-aligned below it.
 */
const tabColumn = computed(() => reversed.value ? 'lg:col-start-2' : 'lg:col-start-1')
const panelColumn = computed(() => reversed.value ? 'lg:col-start-1' : 'lg:col-start-2')
const headerClass = computed(() => {
  if (!stacked.value) return [tabColumn.value, 'lg:self-end']
  return props.header === 'center' ? 'lg:col-span-2 mx-auto max-w-2xl text-center' : 'lg:col-span-2 max-w-2xl'
})
const panelClass = computed(() => [panelColumn.value, stacked.value ? 'lg:row-start-2 lg:self-start' : 'lg:row-start-1 lg:row-span-2 lg:self-end'])

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
    <div
      class="grid lg:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-10"
      :class="stacked ? 'lg:gap-y-16' : 'lg:grid-rows-[1fr_auto]'"
    >
      <div
        v-if="$slots.headline || $slots.title || $slots.description"
        :class="headerClass"
      >
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
          class="mt-4 text-base toned"
          :class="stacked ? '' : 'max-w-lg'"
        >
          <slot
            name="description"
            unwrap="p"
          />
        </p>
      </div>

      <div
        role="tablist"
        aria-orientation="vertical"
        class="space-y-2"
        :class="[tabColumn, stacked && 'lg:self-start']"
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

      <div
        class="relative min-w-0"
        :class="panelClass"
      >
        <div
          v-for="(_, i) in items"
          v-show="activeIndex === i"
          :id="panelId(i)"
          :key="i"
          role="tabpanel"
          :aria-labelledby="tabId(i)"
          :tabindex="0"
          class="*:first:mt-0 *:last:mb-0"
        >
          <slot :name="`code-${i}`" />
        </div>
      </div>
    </div>
  </UPageSection>
</template>

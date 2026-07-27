<script setup lang="ts">
interface Tab {
  icon?: string
  title: string
  description?: string
}

defineProps<{
  items: Tab[]
}>()

const activeIndex = ref(0)
</script>

<template>
  <UPageSection
    :ui="{
      container: 'max-w-5xl py-16 sm:py-16 lg:py-16',
    }"
  >
    <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-end not-prose">
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
            class="mt-6 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-highlighted"
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

        <div class="space-y-2">
          <button
            v-for="(item, i) in items"
            :key="item.title"
            type="button"
            class="w-full flex gap-4 p-4 rounded-xl border text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="activeIndex === i ? 'bg-elevated/50 border-muted' : 'hover:bg-elevated/50 border-transparent'"
            @mouseenter="activeIndex = i"
            @click="activeIndex = i"
            @focus="activeIndex = i"
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
        <template
          v-for="(_, i) in items"
          :key="i"
        >
          <div v-show="activeIndex === i">
            <slot :name="`code-${i}`" />
          </div>
        </template>
      </div>
    </div>
  </UPageSection>
</template>

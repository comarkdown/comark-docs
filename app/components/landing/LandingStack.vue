<script setup lang="ts">
interface StackItem {
  icon: string
  label: string
  to: string
}

defineProps<{
  items: StackItem[]
}>()
</script>

<template>
  <UPageSection
    :ui="{
      container: 'max-w-6xl py-0 sm:py-0 lg:py-0 pb-16 sm:pb-24 lg:pb-32',
    }"
  >
    <div class="not-prose">
      <p class="text-center font-mono font-medium text-xs text-primary uppercase tracking-[0.12em]">// <slot /> //</p>
      <div class="mt-6 grid grid-cols-7 gap-x-2 gap-y-4">
        <NuxtLink
          v-for="item in items"
          :key="item.label"
          :to="item.to"
          class="group flex min-w-0 flex-col items-center gap-2 text-center text-xs font-medium leading-tight text-muted transition-colors hover:text-highlighted sm:text-sm"
          :aria-label="item.label"
        >
          <UIcon
            :name="item.icon"
            class="size-6 sm:size-8 md:size-10 lg:size-12 opacity-60 grayscale transition group-hover:opacity-100 group-hover:grayscale-0"
          />
          <span class="hidden md:inline-block">{{ item.label }}</span>
        </NuxtLink>
      </div>
    </div>
  </UPageSection>
</template>

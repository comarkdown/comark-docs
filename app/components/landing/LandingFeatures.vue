<script setup lang="ts">
defineProps<{
  id?: string
}>()
</script>

<template>
  <UPageSection
    :id="id"
    :ui="{
      container: 'max-w-6xl py-16 sm:py-24',
    }"
  >
    <div class="text-center">
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
        class="mt-4 text-base text-dimmed mx-auto max-w-lg"
      >
        <slot
          name="description"
          unwrap="p"
        />
      </p>
    </div>

    <UPageGrid class="mt-12"><slot /></UPageGrid>
  </UPageSection>
</template>

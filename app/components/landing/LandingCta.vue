<script setup lang="ts">
defineProps<{
  id?: string
}>()
</script>

<template>
  <UPageSection
    :id="id"
    :ui="{
      container: 'max-w-6xl py-16 sm:py-16 lg:py-16',
    }"
  >
    <div class="rounded-2xl border border-default bg-elevated/40 px-8 py-16 sm:px-16 sm:py-20 text-center">
      <h2
        v-if="$slots.title"
        class="text-3xl sm:text-4xl medium tracking-tight leading-tight text-highlighted"
      >
        <slot
          name="title"
          unwrap="p"
        />
      </h2>
      <div
        v-if="$slots.description"
        class="mt-4 text-base text-toned mx-auto max-w-xl"
      >
        <slot
          name="description"
          unwrap="p"
        />
      </div>
      <div
        v-if="$slots.links"
        class="mt-8 flex flex-wrap justify-center gap-3"
      >
        <slot name="links" />
      </div>
    </div>
  </UPageSection>
</template>

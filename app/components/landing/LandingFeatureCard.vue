<script setup lang="ts">
defineProps<{
  icon?: string
  to?: string
}>()
</script>

<template>
  <UPageCard
    :icon="icon"
    :to="to"
    :ui="{
      leadingIcon: 'mb-2 size-4 text-primary',
      title: 'text-sm font-medium tracking-tight text-highlighted',
      description: 'mt-1 text-sm leading-relaxed sm:line-clamp-2 lg:line-clamp-3 text-toned',
    }"
  >
    <template
      v-if="$slots.title"
      #title
    >
      <slot
        name="title"
        unwrap="p"
      />
    </template>

    <template
      v-if="$slots.description"
      #description
    >
      <slot
        name="description"
        unwrap="p"
      />
    </template>
  </UPageCard>
</template>

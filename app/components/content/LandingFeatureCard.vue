<script setup lang="ts">
const props = defineProps<{
  icon?: string
  to?: string
  color?: string
}>()

const rootClass = computed(() => props.color
  ? 'landing-feature-card group transition duration-200 hover:bg-default hover:ring-(--feature-ring) hover:shadow-[0_12px_32px_-20px_var(--feature-glow)]'
  : 'group')

const iconClass = computed(() => props.color
  ? 'mb-2 size-8 text-(--feature-color) grayscale opacity-60 transition duration-200 group-hover:grayscale-0 group-hover:opacity-100'
  : 'mb-2 size-8 text-primary')
</script>

<template>
  <UPageCard
    :icon="icon"
    :to="to"
    :class="rootClass"
    :ui="{
      leadingIcon: iconClass,
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

<style scoped>
.landing-feature-card {
  --feature-color: v-bind(color);
  --feature-ring: color-mix(in oklab, var(--feature-color) 50%, var(--ui-border));
  --feature-glow: color-mix(in oklab, var(--feature-color) 40%, transparent);
}

.landing-feature-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  transition: opacity 200ms;
  background: radial-gradient(140% 110% at 50% 0%, color-mix(in oklab, var(--feature-color) 9%, transparent) 0%, transparent 60%);
}

.landing-feature-card:hover::before {
  opacity: 1;
}
</style>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
}>()

// UHeader renders a second toggle in its menu overlay, mounted already open. Draw it closed for its
// first frame so the lines transition into the cross instead of appearing as one.
const ready = ref(false)
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => {
  ready.value = true
})))
const crossed = computed(() => props.open && ready.value)

// Each line turns around its own center and moves 4px to meet the other at the middle.
const line = 'outline-none origin-center [transform-box:fill-box] transition-[translate,rotate] duration-200 ease-out motion-reduce:transition-none'
</script>

<template>
  <UButton
    size="sm"
    color="neutral"
    variant="outline"
    class="lg:hidden rounded-full cursor-pointer -me-1.5 text-highlighted"
    square
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="butt"
    >
      <line
        x1="4"
        y1="8"
        x2="20"
        y2="8"
        :class="[line, crossed && 'translate-y-[4px] rotate-45']"
      />
      <line
        x1="4"
        y1="16"
        x2="20"
        y2="16"
        :class="[line, crossed && '-translate-y-[4px] -rotate-45']"
      />
    </svg>
  </UButton>
</template>

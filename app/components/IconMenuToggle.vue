<script setup lang="ts">
import { motion } from 'motion-v'
import type { VariantType } from 'motion-v'

const props = defineProps<{
  open: boolean
}>()

const variants: { [k: string]: VariantType | ((custom: unknown) => VariantType) } = {
  normal: {
    rotate: 0,
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      bounce: 0,
      duration: 0.2,
    },
  },
  close: (custom: unknown) => {
    const c = custom as number
    return {
      rotate: c === 1 ? 45 : -45,
      y: c === 1 ? 4 : -4,
      transition: {
        type: 'spring',
        bounce: 0,
        duration: 0.2,
      },
    }
  },
}

const state = computed(() => (props.open ? 'close' : 'normal'))
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
      <motion.line
        x1="4"
        y1="8"
        x2="20"
        y2="8"
        :variants="variants"
        :animate="state"
        :custom="1"
        class="outline-none"
      />
      <motion.line
        x1="4"
        y1="16"
        x2="20"
        y2="16"
        :variants="variants"
        :animate="state"
        :custom="2"
        class="outline-none"
      />
    </svg>
  </UButton>
</template>

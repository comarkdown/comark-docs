<script setup lang="ts">
interface FaqItem {
  label: string
  content: string
}

const props = defineProps<{
  id?: string
  items: FaqItem[]
}>()

// FAQPage structured data mirrors the visible accordion.
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: props.items.map((item) => ({
          '@type': 'Question',
          name: item.label,
          acceptedAnswer: { '@type': 'Answer', text: item.content },
        })),
      }),
    },
  ],
})
</script>

<template>
  <UPageSection
    :id="id"
    :ui="{
      container: 'max-w-3xl py-16 sm:py-24',
    }"
  >
    <div>
      <div class="text-center">
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
      </div>

      <UAccordion
        :items="items"
        class="mt-12"
        :unmount-on-hide="false"
        :ui="{
          trigger: 'text-base',
          body: 'text-base text-toned',
          header: 'text-highlighted',
        }"
      />
    </div>
  </UPageSection>
</template>

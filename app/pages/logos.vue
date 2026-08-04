<script setup lang="ts">
import { joinURL } from 'ufo'
import LogoCard from '../components/LogoCard.vue'

definePageMeta({
  layout: 'docs',
})

const title = 'Brand assets'
const description = 'Logos and assets for the Comark ecosystem. Download SVG or PNG, or copy the raw SVG source directly.'

const site = useSiteConfig()
const canonicalUrl = computed(() => joinURL(site.url, '/logos'))

useRobotsRule('index, follow')

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogUrl: canonicalUrl,
})

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

defineOgImage('DocsSatori', {
  title,
  description,
})
</script>

<template>
  <div>
    <UPageHeader
      :title="title"
      :description="description"
    />

    <UPageBody>
      <section>
        <h2 class="text-2xl text-highlighted font-bold">
          Comark
        </h2>
        <p class="mt-2 mb-6">
          The open-source Markdown parser and renderer.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LogoCard
            logo="comark"
            name="Black"
            bg="#ffffff"
            color="#0a0a0a"
          />
          <LogoCard
            logo="comark"
            name="White"
            bg="#0a0a0a"
            color="#ffffff"
          />
        </div>
      </section>

      <section>
        <h2 class="text-2xl text-highlighted font-bold">
          Comark Content
        </h2>
        <p class="mt-2 mb-6">
          The content layer for Markdown.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LogoCard
            logo="comark-content"
            name="Black"
            bg="#ffffff"
            color="#0a0a0a"
          />
          <LogoCard
            logo="comark-content"
            name="White"
            bg="#0a0a0a"
            color="#ffffff"
          />
        </div>
      </section>
    </UPageBody>
  </div>
</template>

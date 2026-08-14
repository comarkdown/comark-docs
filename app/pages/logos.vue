<script setup lang="ts">
import { joinURL } from 'ufo'
import LogoCard from '../components/LogoCard.vue'

definePageMeta({
  layout: 'docs',
})

const { header } = useAppConfig()
const brand = computed(() =>
  header?.logo?.mark === 'comark-content'
    ? {
      logo: 'comark-content',
      name: 'Comark Content',
      tagline: 'The content layer for Markdown.'
    } : {
      logo: 'comark',
      name: 'Comark',
      tagline: 'The open-source Markdown parser and renderer.',
    },
)

const title = 'Brand assets'
const description = `Logos and assets for ${brand.value.name}. Download SVG or PNG, or copy the raw SVG source directly.`

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
          {{ brand.name }}
        </h2>
        <p class="mt-2 mb-6">
          {{ brand.tagline }}
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LogoCard
            :logo="brand.logo"
            name="Black"
            bg="#ffffff"
            color="#0a0a0a"
          />
          <LogoCard
            :logo="brand.logo"
            name="White"
            bg="#0a0a0a"
            color="#ffffff"
          />
        </div>
      </section>
    </UPageBody>
  </div>
</template>

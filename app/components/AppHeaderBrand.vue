<script setup lang="ts">
const { header } = useAppConfig()
const cms = useDocsContent()

const ecosystem = computed(() => (header?.ecosystem ?? []) as { mark?: string; to: string; label?: string }[])

// Hover popovers are unusable on touch; switch those to click.
const isTouchDevice = ref(false)
onMounted(() => {
  isTouchDevice.value = window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches
})
</script>

<template>
  <div class="flex shrink-0 items-center gap-2.5">
    <NuxtLink
      to="https://vercel.com/oss"
      aria-label="Vercel"
      target="_blank"
      rel="noopener"
      class="flex text-highlighted!"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="20"
        role="img"
        viewBox="0 0 16 16"
        width="20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          clip-rule="evenodd"
          d="m8 1 8 14H0z"
          fill="currentColor"
          fill-rule="evenodd"
        />
      </svg>
    </NuxtLink>

    <div class="w-4 text-center text-lg text-neutral-300 dark:text-neutral-600">
      <svg
        aria-hidden="true"
        fill="none"
        height="16"
        role="img"
        viewBox="0 0 16 16"
        width="16"
      >
        <path
          clip-rule="evenodd"
          d="m4.02 15.4.3-.7 6-14 .29-.68 1.37.59-.3.69-6 14-.29.68z"
          fill="currentColor"
          fill-rule="evenodd"
        />
      </svg>
    </div>

    <NuxtLink
      :to="prefixLink(header?.to || '/', cms.routeBase)"
      :aria-label="header?.logo?.alt || header?.title"
      class="text-highlighted!"
    >
      <AppHeaderLogo class="shrink-0" :class="{ 'lg:mr-3': !ecosystem.length }" />
    </NuxtLink>

    <UPopover
      v-if="ecosystem.length"
      :mode="isTouchDevice ? 'click' : 'hover'"
      :open-delay="isTouchDevice ? 0 : 100"
      enable-touch
      :content="{ align: 'end', side: 'bottom', sideOffset: 8, alignOffset: header?.logo?.mark === 'comark' ? -16 : 0 }"
      :ui="{ content: 'w-40 rounded-xl p-2' }"
      class="-ml-2"
    >
      <UButton
        icon="i-lucide-chevron-down"
        size="xs"
        color="neutral"
        variant="ghost"
        square
        aria-label="Explore the Comark ecosystem"
        class="group"
        :ui="{
          leadingIcon: 'size-3.5 group-data-[state=open]:rotate-180 transition-transform duration-200',
        }"
      />
      <template #content>
        <NuxtLink
          v-for="(site, index) of ecosystem"
          :key="index"
          :to="site.to"
          :aria-label="site.label"
          target="_blank"
          rel="noopener"
          class="flex items-center px-3 py-2 hover:bg-elevated rounded-lg"
        >
          <LogoMark
            :name="site.mark"
            class="shrink-0 text-highlighted"
          />
        </NuxtLink>
      </template>
    </UPopover>
  </div>
</template>

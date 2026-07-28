<script setup lang="ts">
const { header, footer } = useAppConfig()
const cms = useCMS()
const historyOpen = useVersionHistory()
const navigation = useMainNavigation()
</script>

<template>
  <UHeader :to="prefixLink(header?.to || '/', cms.base)">
    <template #left>
      <AppHeaderBrand />
    </template>

    <AppHeaderCenter class="hidden lg:flex" />

    <template #right>
      <UContentSearchButton
        v-if="header?.search"
        :collapsed="false"
        :icon="false"
        class="text-muted font-normal hidden lg:inline-flex min-w-[150px]"
      />

      <UButton
        icon="i-lucide-history"
        :color="cms.mode === 'prod' ? 'neutral' : 'warning'"
        :variant="cms.mode === 'prod' ? 'outline' : 'subtle'"
        aria-label="Version history"
        :ui="{ leadingIcon: 'size-4' }"
        class="p-2"
        @click="historyOpen = !historyOpen"
      />

      <template v-if="header?.links">
        <UButton
          v-for="(link, index) of header?.links"
          :key="index"
          v-bind="{ color: 'neutral', variant: 'ghost', ...link }"
          class="hidden lg:inline-flex"
        />
      </template>
    </template>

    <template #toggle="{ open, toggle }">
      <IconMenuToggle
        :open="open"
        @click="toggle"
      />
    </template>

    <template #body>
      <div class="flex flex-col justify-between h-full">
        <div class="flex flex-col gap-4">
          <UContentSearchButton
            :collapsed="false"
            size="xl"
            class="w-full font-normal"
            :icon="false"
          />
          <UNavigationMenu
            :items="navigation"
            color="neutral"
            variant="link"
            orientation="vertical"
            :ui="{ root: 'pl-0 -ml-2', link: 'py-2 my-2 text-md' }"
          />
        </div>
        <div class="flex items-center gap-4">
          <template v-if="footer?.links">
            <UButton
              v-for="(link, index) of footer?.links"
              :key="index"
              v-bind="{ color: 'neutral', variant: 'ghost', size: 'md', ...link }"
              class="text-highlighted"
            />
          </template>
          <UColorModeButton
            size="md"
            class="text-highlighted"
          />
        </div>
      </div>
    </template>
  </UHeader>
</template>

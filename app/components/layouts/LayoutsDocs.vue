<script setup lang="ts">
const sidebar = useFilteredNavigation()
const navigationRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

onMounted(() => {
  // make sure Nuxt finished hydration before observing the navigation
  onNuxtReady(() => {
    observer = observeNavigation(navigationRef)
    watch(sidebar, () => {
      nextTick(() => {
        observer = observeNavigation(navigationRef, observer)
      })
    })
  })
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <UContainer>
    <UPage>
      <template #left>
        <UPageAside>
          <div ref="navigationRef">
            <UContentNavigation
              variant="link"
              :collapsible="false"
              :navigation="sidebar"
            />
          </div>
        </UPageAside>
      </template>

      <slot />
    </UPage>
  </UContainer>
</template>

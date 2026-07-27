<script setup lang="ts">
const sidebar = useFilteredNavigation()
const navigationRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

onMounted(() => {
  observer = observeNavigation(navigationRef)
  watch(sidebar, () => {
    // wait for the DOM to update before observing
    nextTick(() => {
      observer = observeNavigation(navigationRef, observer)
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
              ref="navigationRef"
            />
          </div>
        </UPageAside>
      </template>

      <slot />
    </UPage>
  </UContainer>
</template>

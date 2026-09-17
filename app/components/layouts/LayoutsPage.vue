<template>
  <UContainer class="max-w-7xl">
    <UTheme :ui="{ pageHeader: { container: 'lg:pt-8' }, contentToc: { container: 'lg:pt-16' } }">
      <slot />
    </UTheme>
  </UContainer>
</template>

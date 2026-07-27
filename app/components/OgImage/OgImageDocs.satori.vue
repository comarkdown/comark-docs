<script setup lang="ts">
/**
 * Default OG image template. Consumers override it by shipping their own
 * `components/OgImage/OgImageDocs.satori.vue`.
 */
defineOptions({
  inheritAttrs: false,
})

const { headline = '' } = defineProps<{
  title?: string
  description?: string
  headline?: string
}>()

const { seo } = useAppConfig()
const site = useSiteConfig()

const siteName = seo?.siteName || site.name || ''
const host = site.url ? site.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''

function truncate(str: string, max: number) {
  if (!str || str.length <= max) return str
  const cut = str.lastIndexOf(' ', max)
  return `${str.slice(0, cut > 0 ? cut : max)}…`
}
</script>

<template>
  <div class="flex flex-row size-full min-h-full">
    <div
      class="flex flex-col shrink-0 items-center min-h-full"
      style="width: 200px; background: #fafafa"
    >
      <div
        class="flex shrink-0 flex-col items-center w-full"
        style="padding: 48px 24px 0"
      >
        <div
          style="
            font-family: 'Geist';
            font-size: 24px;
            font-weight: 800;
            line-height: 1.2;
            color: #09090b;
            letter-spacing: -0.02em;
            text-align: center;
          "
        >
          {{ siteName }}
        </div>
      </div>
      <div class="min-h-0 w-full flex-1" />
      <div
        v-if="host"
        class="flex w-full items-center justify-center shrink-0"
        style="padding: 0 12px 36px"
      >
        <div
          style="
            font-family: 'Geist Mono';
            font-size: 13px;
            font-weight: 600;
            line-height: 1;
            color: #09090b;
            letter-spacing: 0.12em;
            opacity: 0.5;
          "
        >
          {{ host }}
        </div>
      </div>
    </div>

    <div
      class="flex flex-col flex-1 min-h-0 min-w-0"
      style="background: #09090b; position: relative; overflow: hidden"
    >
      <div
        style="
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(234, 179, 8, 0.03) 1px, transparent 1px);
          background-size: 28px 28px;
        "
      />

      <div
        class="flex flex-col flex-1 justify-center min-h-0"
        style="position: relative; z-index: 1; padding: 48px 56px 0"
      >
        <div
          v-if="headline"
          style="
            font-family: 'Geist Mono';
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: #eeeeee;
            margin-bottom: 24px;
          "
        >
          {{ headline }}
        </div>

        <div
          style="
            font-family: 'Geist';
            font-size: 72px;
            font-weight: 800;
            color: #fafafa;
            line-height: 1;
            letter-spacing: -0.035em;
          "
        >
          {{ title || siteName }}
        </div>

        <div
          v-if="description"
          style="
            font-family: 'Geist';
            font-size: 24px;
            color: #a1a1aa;
            line-height: 1.5;
            margin-top: 24px;
            max-width: 700px;
          "
        >
          {{ truncate(description, 120) }}
        </div>
      </div>

      <div
        v-if="site.description"
        class="flex shrink-0 items-center min-w-0"
        style="position: relative; z-index: 1; padding: 0 56px 36px"
      >
        <div style="display: flex; align-items: center; gap: 16px; width: 100%">
          <div style="flex: 1; height: 1px; background: #fafafa" />
          <div
            style="
              font-family: 'Geist Mono';
              font-size: 13px;
              font-weight: 500;
              line-height: 1;
              letter-spacing: 0.12em;
              color: #fafafa;
              white-space: nowrap;
            "
          >
            {{ truncate(site.description, 60).toUpperCase() }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

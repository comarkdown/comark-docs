<script setup lang="ts">
/**
 * The OG image template, shared by every site on this layer.
 *
 * Marks are inlined rather than split into components: nuxt-og-image renders this through an
 * island registering only OG templates, so a nested `<OgLogoMark />` silently renders nothing.
 */
defineOptions({
  inheritAttrs: false,
})

const { title = '', description = '', headline = '' } = defineProps<{
  title?: string
  description?: string
  headline?: string
}>()

const { seo, docs } = useAppConfig()
const site = useSiteConfig()

const siteName = seo?.siteName || site.name || ''
const host = site.url ? site.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''
const accent = docs?.ogImage?.accent || '#fafafa'
const tagline = docs?.ogImage?.tagline || site.description || ''
const mark = docs?.ogImage?.mark || 'wordmark'

// `withAlpha` / `truncate` live in `app/utils/og.ts` so they can be unit-tested — this
// template only renders inside a nuxt-og-image island.
</script>

<template>
  <div class="flex flex-row size-full min-h-full">
    <div
      class="flex flex-col shrink-0 items-center min-h-full"
      :style="`width: 200px; background: ${accent}`"
    >
      <div
        class="flex shrink-0 flex-col items-center w-full"
        style="padding: 48px 24px 0"
      >
        <!-- The Comark mark: outlined square, four dots, an `M`. -->
        <svg
          v-if="mark === 'comark'"
          xmlns="http://www.w3.org/2000/svg"
          width="100"
          height="62"
          viewBox="0 0 208 128"
          fill="none"
        >
          <path
            stroke="#09090b"
            stroke-width="8"
            d="M199 9v110H9V9h190Z"
          />
          <path
            fill="#09090b"
            d="M128 51.25V32h19.937v19.25H128ZM128 96V76.75h19.937V96H128ZM158.063 51.25V32H178v19.25h-19.937Zm0 44.75V76.75H178V96h-19.937ZM30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39H30Z"
          />
        </svg>

        <!-- The Comark CMS mark: `CMS` set in a pill. -->
        <svg
          v-else-if="mark === 'comark-cms'"
          xmlns="http://www.w3.org/2000/svg"
          width="100"
          height="53"
          viewBox="0 0 129 69"
          fill="none"
        >
          <rect
            x="3"
            y="4"
            width="123"
            height="61"
            rx="30"
            stroke="#09090b"
            stroke-width="6"
          />
          <path
            fill="#09090b"
            d="M31.872 50.672C23.724 50.672 17.886 44.876 17.886 35.132C17.886 25.64 23.388 19.508 31.998 19.508C39.81 19.508 44.01 23.498 45.27 30.596L38.634 30.848C37.962 27.11 35.694 24.884 31.998 24.884C27.252 24.884 24.48 28.916 24.48 35.132C24.48 41.432 27.378 45.296 31.956 45.296C35.946 45.296 38.13 42.902 38.718 38.87L45.396 39.122C44.178 46.388 39.642 50.672 31.872 50.672ZM49.623 50V20.18H58.149L65.751 41.894L73.311 20.18H81.837V50H75.453V30.68L68.439 49.916H62.979L56.007 30.68V50H49.623ZM99.2 50.672C91.472 50.672 86.936 46.556 86.474 40.172L92.9 39.878C93.404 43.406 95.42 45.38 99.284 45.38C102.434 45.38 104.282 44.204 104.282 41.936C104.282 39.878 103.232 38.66 97.646 37.4C90.002 35.678 87.062 33.578 87.062 28.496C87.062 23.162 91.22 19.508 98.234 19.508C105.626 19.508 109.616 23.708 110.246 29.588L103.862 29.924C103.526 26.816 101.552 24.8 98.15 24.8C95.252 24.8 93.488 26.186 93.488 28.286C93.488 30.512 94.874 31.436 99.704 32.444C107.978 34.124 110.708 37.106 110.708 41.642C110.708 47.228 106.256 50.672 99.2 50.672Z"
          />
        </svg>

        <div
          v-else
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
        :style="`
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, ${withAlpha(accent, 0.03)} 1px, transparent 1px);
          background-size: 28px 28px;
        `"
      />

      <div
        class="flex flex-col flex-1 justify-center min-h-0"
        style="position: relative; z-index: 1; padding: 48px 56px 0"
      >
        <div
          v-if="headline"
          :style="`
            font-family: 'Geist Mono';
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: ${accent};
            margin-bottom: 24px;
          `"
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
        v-if="tagline"
        class="flex shrink-0 items-center min-w-0"
        style="position: relative; z-index: 1; padding: 0 56px 36px"
      >
        <div style="display: flex; align-items: center; gap: 16px; width: 100%">
          <div :style="`flex: 1; height: 1px; background: ${accent}`" />
          <div
            :style="`
              font-family: 'Geist Mono';
              font-size: 13px;
              font-weight: 500;
              line-height: 1;
              letter-spacing: 0.12em;
              color: ${accent};
              white-space: nowrap;
            `"
          >
            {{ truncate(tagline, 60).toUpperCase() }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

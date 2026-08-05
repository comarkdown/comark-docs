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

const { seo, docs, header } = useAppConfig()
const site = useSiteConfig()

const siteName = seo?.siteName || site.name || ''
const host = site.url ? site.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''
const accent = docs?.ogImage?.accent || '#fafafa'
const mark = header?.logo?.mark || 'wordmark'

// `withAlpha` / `truncate` live in `app/utils/og.ts` so they can be unit-tested — this
// template only renders inside a nuxt-og-image island.
</script>

<template>
  <div
    class="flex flex-col flex-1 min-h-full min-w-full"
    style="background: #000; position: relative; overflow: hidden"
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
      style="position: relative; z-index: 1; padding: 50px 80px 0"
    >
      <!-- The Comark mark: outlined square, four dots, an `M`. -->
      <svg
        v-if="mark === 'comark'"
        width="156"
        height="30"
        viewBox="0 0 562 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Comark"
        style="position: absolute; top: 80px; left: 80px;"
        >
        <path
          d="M186 4V106H4V4H186Z"
          stroke="#ffffff"
          stroke-width="8"
        />
        <path
          d="M244.224 89.472C226.376 89.472 213.956 76.776 213.956 55.432C213.956 34.456 226.008 21.208 244.316 21.208C260.968 21.208 269.892 29.948 272.744 44.76L260.232 45.404C258.576 36.848 253.332 31.604 244.316 31.604C233.184 31.604 226.284 40.896 226.284 55.432C226.284 70.152 233.368 79.076 244.224 79.076C253.976 79.076 259.128 73.464 260.6 64.08L273.112 64.724C270.536 80.088 260.692 89.472 244.224 89.472ZM303.55 89.104C288.922 89.104 279.354 78.984 279.354 63.436C279.354 47.888 288.922 37.768 303.55 37.768C318.086 37.768 327.654 47.888 327.654 63.436C327.654 78.984 318.086 89.104 303.55 89.104ZM303.55 79.536C311.094 79.536 315.418 73.648 315.418 63.436C315.418 53.316 311.094 47.336 303.55 47.336C295.914 47.336 291.59 53.316 291.59 63.436C291.59 73.648 295.914 79.536 303.55 79.536ZM336.741 88V38.872H347.413L347.689 47.06C350.173 41.172 355.141 37.768 361.213 37.768C368.389 37.768 373.357 41.54 375.473 47.888C377.681 41.356 382.741 37.768 389.549 37.768C399.669 37.768 405.925 44.3 405.925 56.444V88H394.149V59.48C394.149 51.384 391.481 47.336 385.777 47.336C380.165 47.336 376.761 51.936 376.761 59.848V88H365.813V59.848C365.813 51.844 363.605 47.336 357.625 47.336C352.013 47.336 348.517 52.028 348.517 59.848V88H336.741ZM431.95 89.104C421.646 89.104 414.838 84.228 414.838 75.672C414.838 67.208 420.082 62.7 430.846 60.584L447.13 57.364C447.13 50.464 443.91 46.876 437.654 46.876C431.95 46.876 428.73 49.544 427.626 54.512L415.666 53.96C417.598 43.656 425.51 37.768 437.654 37.768C451.638 37.768 458.906 45.128 458.906 58.192V76.04C458.906 78.708 459.826 79.444 461.666 79.444H463.23V88C462.402 88.184 460.562 88.368 458.906 88.368C453.662 88.368 449.706 86.528 448.694 80.548V80.456C446.21 85.7 439.954 89.104 431.95 89.104ZM434.342 80.548C442.162 80.548 447.13 75.58 447.13 68.128V65.368L434.434 67.944C429.19 68.956 427.074 71.164 427.074 74.568C427.074 78.432 429.65 80.548 434.342 80.548ZM470.878 88V38.872H481.918L482.194 48.44C484.126 41.816 487.898 38.872 493.97 38.872H498.478V48.992H493.878C486.334 48.992 482.654 52.12 482.654 59.664V88H470.878ZM506.096 88V22.68H517.872V61.044L538.02 38.872H552.556L533.328 59.296L553.2 88H539.952L525.6 66.288L517.872 74.476V88H506.096Z"
          fill="#ffffff"
        />
        <path
          d="M119 42.25V23H138.937V42.25H119ZM119 87V67.75H138.937V87H119ZM149.063 42.25V23H169V42.25H149.063ZM149.063 87V67.75H169V87H149.063ZM21 89V21H41L61 46L81 21H101V89H81V50L61 75L41 50V89H21Z"
          fill="#ffffff"
        />
        </svg>

        <!-- The Comark Content mark: `CMS` set in a pill. -->
        <svg v-else-if="mark === 'comark-content'" xmlns="http://www.w3.org/2000/svg" width="253" height="30" fill="none" viewBox="0 0 582 69" role="img" aria-label="Comark Content" style="position: absolute; top: 80px; left: 80px;">
          <path fill="#ffffff" d="M398.368 39.962c-1.344 6.51-5.796 10.71-12.894 10.71-8.82 0-14.28-6.72-14.28-15.54s5.46-15.624 14.28-15.624c6.804 0 11.34 4.032 12.726 10.206l-6.342.336c-.756-3.234-3.024-5.334-6.51-5.334-5.418 0-7.854 4.578-7.854 10.416 0 5.796 2.478 10.332 7.854 10.332 3.654 0 5.922-2.352 6.594-5.838zm16.321 10.71c-8.778 0-14.28-6.006-14.28-15.54 0-9.618 5.502-15.624 14.28-15.624s14.28 6.006 14.28 15.624c0 9.534-5.502 15.54-14.28 15.54m-7.98-15.54c0 6.636 2.856 10.332 7.98 10.332 5.166 0 7.98-3.696 7.98-10.332 0-6.678-2.814-10.416-7.98-10.416-5.124 0-7.98 3.738-7.98 10.416m25.368-14.952h6.846l12.012 20.958V20.18h6.132V50h-7.098l-11.76-20.286V50h-6.132zm51.878 0v5.208h-8.946V50h-6.132V25.388h-8.946V20.18zm3.065 0h20.538v5.208h-14.406v7.098h13.902v5.124h-13.902v7.182h14.742V50H487.02zm24.539 0h6.846l12.012 20.958V20.18h6.132V50h-7.098l-11.76-20.286V50h-6.132zm51.878 0v5.208h-8.946V50h-6.132V25.388h-8.946V20.18z"/>
          <rect width="222" height="61" x="357" y="4" stroke="#ffffff" stroke-width="6" rx="30"/>
          <path fill="#ffffff" d="M30.268 68.264C12.42 68.264 0 55.568 0 34.224 0 13.248 12.052 0 30.36 0c16.652 0 25.576 8.74 28.428 23.552l-12.512.644c-1.656-8.556-6.9-13.8-15.916-13.8-11.132 0-18.032 9.292-18.032 23.828 0 14.72 7.084 23.644 17.94 23.644 9.752 0 14.904-5.612 16.376-14.996l12.512.644C56.58 58.88 46.736 68.264 30.268 68.264M88.594 67.896c-14.628 0-24.196-10.12-24.196-25.668S73.966 16.56 88.594 16.56c14.536 0 24.104 10.12 24.104 25.668s-9.568 25.668-24.104 25.668m0-9.568c7.544 0 11.868-5.888 11.868-16.1 0-10.12-4.324-16.1-11.868-16.1-7.636 0-11.96 5.98-11.96 16.1 0 10.212 4.324 16.1 11.96 16.1M120.785 66.792V17.664h10.672l.276 8.188c2.484-5.888 7.452-9.292 13.524-9.292 7.176 0 12.144 3.772 14.26 10.12 2.208-6.532 7.268-10.12 14.076-10.12 10.12 0 16.376 6.532 16.376 18.676v31.556h-11.776v-28.52c0-8.096-2.668-12.144-8.372-12.144-5.612 0-9.016 4.6-9.016 12.512v28.152h-10.948V38.64c0-8.004-2.208-12.512-8.188-12.512-5.612 0-9.108 4.692-9.108 12.512v28.152zM214.994 67.896c-10.304 0-17.112-4.876-17.112-13.432 0-8.464 5.244-12.972 16.008-15.088l16.284-3.22c0-6.9-3.22-10.488-9.476-10.488-5.704 0-8.924 2.668-10.028 7.636l-11.96-.552c1.932-10.304 9.844-16.192 21.988-16.192 13.984 0 21.252 7.36 21.252 20.424v17.848c0 2.668.92 3.404 2.76 3.404h1.564v8.556c-.828.184-2.668.368-4.324.368-5.244 0-9.2-1.84-10.212-7.82v-.092c-2.484 5.244-8.74 8.648-16.744 8.648m2.392-8.556c7.82 0 12.788-4.968 12.788-12.42v-2.76l-12.696 2.576c-5.244 1.012-7.36 3.22-7.36 6.624 0 3.864 2.576 5.98 7.268 5.98M252.922 66.792V17.664h11.039l.276 9.568c1.932-6.624 5.704-9.568 11.776-9.568h4.509v10.12h-4.6c-7.544 0-11.224 3.128-11.224 10.672v28.336zM287.14 66.792V1.472h11.776v38.364l20.148-22.172H333.6l-19.228 20.424 19.872 28.704h-13.248L306.644 45.08l-7.728 8.188v13.524z"/>
        </svg>
      <div
        v-if="headline"
        :style="`
        font-family: 'Geist Mono';
        font-size: 16px;
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
        font-size: 76px;
        font-weight: 500;
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
        font-size: 28px;
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
      v-if="host"
      class="flex shrink-0 items-center min-w-0"
      style="position: absolute; z-index: 1; bottom: 40px; left: 80px"
    >
    <div style="display: flex; align-items: center;width: 100%">
      <div
        :style="`
            font-family: 'Geist Mono';
            font-size: 16px;
            font-weight: 500;
            line-height: 1;
            letter-spacing: 0.12em;
            color: ${accent};
            white-space: nowrap;
        `"
        >
        {{ host }}
        </div>
      </div>
    </div>
  </div>
</template>

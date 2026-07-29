<script setup lang="ts">
import LogoComarkVue from './LogoComark.vue'
import LogoComarkCmsVue from './LogoComarkCms.vue'

const props = defineProps<{
  logo: 'comark' | 'comark-cms'
  name: string
  bg: string
  color: string
}>()

const logoComponent = computed(() => props.logo === 'comark' ? LogoComarkVue : LogoComarkCmsVue)
const viewBox = computed(() => props.logo === 'comark' ? { w: 562, h: 110 } : { w: 489, h: 69 })
const filePrefix = computed(() => `${props.logo}-${props.name.toLowerCase()}`)

const svgRef = ref<HTMLElement | null>(null)
const copied = ref(false)

function extractSvg(width?: number, height?: number): string | null {
  const el = svgRef.value
  if (!el) return null
  const svgEl = el.querySelector('svg')
  if (!svgEl) return null
  const clone = svgEl.cloneNode(true) as SVGElement
  clone.removeAttribute('class')
  if (!clone.hasAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (width != null) clone.setAttribute('width', String(width))
  if (height != null) clone.setAttribute('height', String(height))
  const applyColor = (node: Element) => {
    if (node.getAttribute('fill') === 'currentColor') node.setAttribute('fill', props.color)
    if (node.getAttribute('stroke') === 'currentColor') node.setAttribute('stroke', props.color)
    for (const child of Array.from(node.children)) applyColor(child)
  }
  applyColor(clone)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`
}

async function copySvg() {
  const svg = extractSvg()
  if (!svg) return
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
  await navigator.clipboard.writeText(svg)
}

function downloadSvg() {
  const svg = extractSvg()
  if (!svg) return
  triggerDownload(
    URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })),
    `${filePrefix.value}.svg`,
  )
}

async function downloadPng() {
  const PAD = 64
  const SCALE = 4
  const { w, h } = viewBox.value
  const svg = extractSvg(w * SCALE, h * SCALE)
  if (!svg) return

  const canvas = document.createElement('canvas')
  canvas.width = (w + PAD * 2) * SCALE
  canvas.height = (h + PAD * 2) * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = props.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const img = new Image()
  // Data URLs are more reliable than blob URLs for SVG → canvas in Chromium.
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  ctx.drawImage(img, PAD * SCALE, PAD * SCALE)

  const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!pngBlob) return
  triggerDownload(URL.createObjectURL(pngBlob), `${filePrefix.value}.png`)
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div class="rounded-xl border border-default overflow-hidden">
    <div
      ref="svgRef"
      class="flex items-center justify-center py-14 px-10"
      :style="{ backgroundColor: bg }"
    >
      <component
        :is="logoComponent"
        :style="{ color, height: '1.75rem', width: 'auto' }"
      />
    </div>

    <div class="flex items-center justify-between px-4 py-3 bg-muted">
      <span class="text-sm text-muted font-medium">{{ name }}</span>
      <div class="flex items-center gap-1.5">
        <UTooltip text="Copy SVG">
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-clipboard'"
            color="neutral"
            variant="ghost"
            size="xs"
            square
            class="cursor-pointer"
            @click="copySvg"
          />
        </UTooltip>
        <UButton
          label="SVG"
          color="neutral"
          variant="outline"
          size="xs"
          class="cursor-pointer"
          @click="downloadSvg"
        />
        <UButton
          label="PNG"
          color="neutral"
          variant="outline"
          size="xs"
          class="cursor-pointer"
          @click="downloadPng"
        />
      </div>
    </div>
  </div>
</template>

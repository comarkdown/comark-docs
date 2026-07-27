<script setup lang="ts">
import type { CMSFile } from '@comark/cms'
import { useClipboard } from '@vueuse/core'
import type { PageLink } from '@nuxt/ui'
import { accordionItem } from '#build/ui/prose'

const props = defineProps<{ page: CMSFile }>()

const route = useRoute()
const toast = useToast()
const cms = useCMS()
const { copy, copied } = useClipboard()
const { copy: copyLink } = useClipboard()
const copying = ref(false)
const site = useSiteConfig()

const mdPath = computed(() => `/raw${route.path}.md`)
const mdUrl = computed(() => `${site.url}${mdPath.value}`)

const { github, docs } = useAppConfig()
const githubUrl = computed(
  () => github?.url || (github?.owner && github?.name ? `https://github.com/${github.owner}/${github.name}` : '')
)

const links = computed(() => [
  ...(githubUrl.value
    ? [
        {
          icon: 'i-simple-icons-github',
          label: 'Edit this page on GitHub',
          to: `${githubUrl.value}/edit/${cms.value.mode === 'tree' ? cms.value.ref : github?.branch || 'main'}/${github?.contentDir || 'content'}/${props.page.meta.stem}${props.page.meta.extension}`,
          target: '_blank',
          disabled: cms.value.mode === 'blob',
          class: cms.value.mode === 'blob' ? 'text-dimmed hover:text-dimmed cursor-not-allowed' : undefined,
        },
        {
          icon: 'i-lucide-star',
          label: 'Star on GitHub',
          to: githubUrl.value,
          target: '_blank',
        },
      ]
    : []),
  ...((docs?.asideLinks ?? []).map((link: { label: string; icon?: string; to: string; target?: string }) => ({
    target: '_blank',
    ...link,
  })) as PageLink[]),
])

async function copyPage() {
  copying.value = true
  try {
    const md = await $fetch<string>(mdPath.value)
    copy(md)
  } catch {
    toast.add({ title: 'Could not copy page.', color: 'error' })
  } finally {
    copying.value = false
  }
}

const aiPrompt = computed(() => `Read ${mdUrl.value} so I can ask questions about it.`)
const items = [
  [
    {
      label: 'Copy prompt',
      icon: 'i-lucide-clipboard',
      onSelect() {
        copyLink(aiPrompt.value)
        toast.add({
          title: 'Prompt copied to clipboard',
          color: 'success',
          icon: 'i-lucide-check',
        })
      },
    },
  ],
  [
    {
      label: 'Open in V0',
      icon: 'i-simple-icons:v0',
      target: '_blank',
      to: `https://v0.app/?q=${encodeURIComponent(aiPrompt.value)}`,
    },
    {
      label: 'Open in ChatGPT',
      icon: 'i-simple-icons:openai',
      target: '_blank',
      to: `https://chatgpt.com/?hints=search&q=${encodeURIComponent(aiPrompt.value)}`,
    },
    {
      label: 'Open in Claude',
      icon: 'i-simple-icons:claude',
      target: '_blank',
      to: `https://claude.ai/new?q=${encodeURIComponent(aiPrompt.value)}`,
    },
    {
      label: 'Open in Cursor',
      icon: 'i-simple-icons:cursor',
      target: '_blank',
      to: `https://cursor.com/link/prompt?text=${encodeURIComponent(aiPrompt.value)}`,
    },
  ],
]
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <UPageLinks
      :links="links"
      :ui="{ list: 'gap-2.5' }"
    />
    <UButton
      :disabled="cms.mode !== 'prod'"
      @click="copyPage"
      :loading="copying"
      :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      :color="copied ? 'success' : 'neutral'"
      :label="copied ? 'Copied!' : 'Copy page'"
      variant="link"
      class="px-0 py-0 font-normal"
      :class="{ 'text-muted': !copied }"
      :ui="{ leadingIcon: 'size-3.5' }"
    />
    <UDropdownMenu
      :items="items"
      :content="{ align: 'start', side: 'bottom', alignOffset: -8 }"
      :ui="{ itemLeadingIcon: 'size-3.5', item: 'items-center', content: 'bg-white dark:bg-muted/30' }"
      v-slot="{ open }"
    >
      <UButton
        icon="i-lucide-message-circle"
        color="neutral"
        variant="link"
        aria-label="Open copy actions menu"
        label="Open in Chat"
        :disabled="cms.mode !== 'prod'"
        class="font-normal px-0 py-0"
        trailingIcon="i-lucide-chevron-down"
        :ui="{
          leadingIcon: 'size-3.5',
          trailingIcon: 'size-3.5 -ml-0.5 transition-transform duration-200' + (open ? ' rotate-180' : ''),
        }"
        :class="[open ? 'text-highlighted' : 'text-muted']"
      />
    </UDropdownMenu>
  </div>
</template>

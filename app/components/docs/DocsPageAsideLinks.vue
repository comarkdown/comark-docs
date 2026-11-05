<script setup lang="ts">
import type { ContentFile } from 'comark-content'
import { useClipboard } from '@vueuse/core'
import type { PageLink } from '@nuxt/ui'

const props = defineProps<{ page: ContentFile }>()

const route = useRoute()
const toast = useToast()
const content = useDocsContent()
const { copy } = useClipboard()
const { copy: copyLink } = useClipboard()
const site = useSiteConfig()

const { rawPrefix } = useRuntimeConfig().public.agentDiscovery
const mdPath = computed(() => `${rawPrefix}${route.path}.md`)
const mdUrl = computed(() => `${site.url}${mdPath.value}`)

const { github, docs } = useAppConfig()
const githubUrl = computed(
  () => github?.url || (github?.owner && github?.name ? `https://github.com/${github.owner}/${github.name}` : '')
)

// The raw markdown route reads production content, so a versioned preview has nothing to open.
const isProd = computed(() => content.value.mode === 'prod')
const disabledLinkClass = 'text-dimmed hover:text-dimmed cursor-not-allowed'

const links = computed(() => [
  ...(githubUrl.value
    ? [
        {
          icon: 'i-simple-icons-github',
          label: 'Edit this page on GitHub',
          to: `${githubUrl.value}/edit/${content.value.mode === 'tree' ? content.value.ref : github?.branch || 'main'}/${github?.contentDir || 'content'}/${props.page.meta.stem}${props.page.meta.extension}`,
          target: '_blank',
          // /blob/ pins a commit and /pr/ may come from a fork branch this site can't link an editor to.
          disabled: ['blob', 'pr'].includes(content.value.mode),
          class: ['blob', 'pr'].includes(content.value.mode) ? disabledLinkClass : undefined,
        },
        {
          icon: 'i-lucide-star',
          label: 'Star on GitHub',
          to: githubUrl.value,
          target: '_blank',
        },
      ]
    : []),
  {
    icon: 'i-simple-icons-markdown',
    label: 'Open as Markdown',
    to: mdPath.value,
    target: '_blank',
    disabled: !isProd.value,
    class: !isProd.value ? disabledLinkClass : undefined,
  },
  ...((docs?.asideLinks ?? []).map((link: { label: string; icon?: string; to: string; target?: string }) => ({
    target: '_blank',
    ...link,
  })) as PageLink[]),
])

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
    {
      label: 'Copy page',
      icon: 'i-lucide-copy',
      async onSelect() {
        try {
          copy(await $fetch<string>(mdPath.value))
          toast.add({
            title: 'Page copied to clipboard',
            color: 'success',
            icon: 'i-lucide-check',
          })
        } catch {
          toast.add({ title: 'Could not copy page.', color: 'error' })
        }
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
    <UDropdownMenu
      v-slot="{ open }"
      :items="items"
      :content="{ align: 'start', side: 'bottom', alignOffset: -8 }"
      :ui="{ itemLeadingIcon: 'size-3.5', item: 'items-center', content: 'bg-white dark:bg-muted/30' }"
    >
      <UButton
        icon="i-lucide-message-circle"
        color="neutral"
        variant="link"
        aria-label="Open copy actions menu"
        label="Open in Chat"
        :disabled="!isProd"
        class="font-normal px-0 py-0"
        trailing-icon="i-lucide-chevron-down"
        :ui="{
          leadingIcon: 'size-3.5',
          trailingIcon: 'size-3.5 -ml-0.5 transition-transform duration-200' + (open ? ' rotate-180' : ''),
        }"
        :class="[open ? 'text-highlighted' : 'text-muted']"
      />
    </UDropdownMenu>
  </div>
</template>

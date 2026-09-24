<script setup lang="ts">
import { DefaultChatTransport, isReasoningUIPart, isTextUIPart, isToolUIPart, getToolName, type ToolUIPart, type DynamicToolUIPart, type UIMessage } from 'ai'
import { useChat } from '@ai-sdk/vue'
import { isPartStreaming, isToolStreaming } from '@nuxt/ui/utils/ai'
import rangi from 'comark/plugins/rangi'
import { geistTheme } from '../../utils/geist'

const MAX_INPUT = 1000

const open = useAssistant()
const { assistant } = useAppConfig()

const input = ref('')
const { messages, status, error, sendMessage, regenerate, stop } = useChat({
  transport: new DefaultChatTransport({ api: '/api/assistant' }),
})

const plugins = [rangi({ theme: geistTheme })]

// Suggestions grouped by category, shown before the first message.
const questions = computed(() => assistant?.faqQuestions ?? [])

// Compact prose sizes for the narrow panel
const proseUi = {
  prose: {
    p: { base: 'my-2 text-sm/6' },
    li: { base: 'my-0.5 text-sm/6' },
    ul: { base: 'my-2' },
    ol: { base: 'my-2' },
    h1: { base: 'text-xl mb-4' },
    h2: { base: 'text-lg mt-6 mb-3' },
    h3: { base: 'text-base mt-4 mb-2' },
    h4: { base: 'text-sm mt-3 mb-1.5' },
    code: { base: 'text-xs' },
    pre: { root: 'my-2', base: 'text-xs/5' },
    table: { root: 'my-2' },
    hr: { base: 'my-4' },
  },
}

// The panel mounts on every page (for the push-header layout), so autofocus would steal
// focus on load. Focus the prompt only once the assistant actually opens.
const promptRef = ref<{ textareaRef?: HTMLTextAreaElement } | null>(null)
watch(open, (isOpen) => {
  if (!isOpen) return
  nextTick(() => promptRef.value?.textareaRef?.focus({ preventScroll: true }))
})

watch(input, (value) => {
  if (value.length > MAX_INPUT) input.value = value.slice(0, MAX_INPUT)
})

function onSubmit() {
  const text = input.value.trim()
  if (!text) return
  sendMessage({ text })
  input.value = ''
}

function ask(question: string) {
  sendMessage({ text: question })
}

const copied = ref(false)
async function copyConversation() {
  const text = messages.value
    .map((message) => {
      const content = message.parts.filter(isTextUIPart).map((part) => part.text).join('\n')
      return `${message.role === 'user' ? 'User' : 'Assistant'}:\n${content}`
    })
    .join('\n\n')
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function clearChat() {
  stop()
  messages.value = []
}

function toolMeta(part: ToolUIPart | DynamicToolUIPart) {
  const name = getToolName(part)
  const streaming = isToolStreaming(part)
  const input = part.input as Record<string, string> | undefined
  if (name === 'search_docs') {
    return { icon: 'i-lucide-text-search', text: streaming ? 'Searching the docs' : 'Searched the docs', suffix: input?.query }
  }
  if (name === 'get_page') {
    return { icon: 'i-lucide-book-open', text: streaming ? 'Reading a page' : 'Read a page', suffix: input?.path }
  }
  return { icon: 'i-lucide-wrench', text: name.replace(/_/g, ' ') }
}

/** Live tool rows show while the answer streams; once done they collapse into one "Used N sources" row. */
function isMessageStreaming(message: UIMessage) {
  const last = messages.value[messages.value.length - 1]
  return (
    message.role === 'assistant' &&
    message.id === last?.id &&
    (status.value === 'streaming' || status.value === 'submitted')
  )
}

/** Unique doc pages the assistant read for this message, in call order. */
function messageSources(message: UIMessage) {
  const paths = new Set<string>()
  for (const part of message.parts) {
    if (isToolUIPart(part) && getToolName(part) === 'get_page') {
      const path = (part.input as { path?: string } | undefined)?.path
      if (path) paths.add(path.startsWith('/') ? path : `/${path}`)
    }
  }
  return [...paths]
}

function messageToolCount(message: UIMessage) {
  return message.parts.filter((part) => isToolUIPart(part)).length
}

function sourcesLabel(message: UIMessage) {
  const count = messageSources(message).length || messageToolCount(message)
  return `Used ${count} source${count === 1 ? '' : 's'}`
}
</script>

<template>
  <USidebar
    v-model:open="open"
    side="right"
    title="Chat"
    close
    close-icon="i-lucide-panel-right-close"
    :style="{ '--sidebar-width': '24rem' }"
    :ui="{ actions: 'gap-0.5' }"
  >
    <template #actions>
      <UButton
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        color="neutral"
        variant="ghost"
        :disabled="!messages.length"
        :ui="{ leadingIcon: 'size-4' }"
        aria-label="Copy conversation"
        @click="copyConversation"
      />
      <UButton
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        :disabled="!messages.length"
        :ui="{ leadingIcon: 'size-4' }"
        aria-label="Clear conversation"
        @click="clearChat"
      />
    </template>

    <UTheme :ui="proseUi">
      <UChatMessages
        v-if="messages.length"
        should-auto-scroll
        :messages="messages"
        :status="status"
        compact
        class="px-0"
        :user="{ side: 'right', variant: 'soft' }"
        :assistant="{ side: 'left', variant: 'naked' }"
      >
        <template #indicator>
          <AssistantIndicator />
        </template>

        <template #content="{ message }">
          <UChatTool
            v-if="message.role === 'assistant' && !isMessageStreaming(message) && messageToolCount(message)"
            icon="i-lucide-bookmark"
            :text="sourcesLabel(message)"
          >
            <div
              v-if="messageSources(message).length"
              class="flex flex-col items-start gap-1 pt-1"
            >
              <ULink
                v-for="path in messageSources(message)"
                :key="path"
                :to="path"
                class="text-sm text-muted hover:text-highlighted"
              >
                {{ path }}
              </ULink>
            </div>
          </UChatTool>

          <template
            v-for="(part, index) in message.parts"
            :key="`${message.id}-${part.type}-${index}`"
          >
            <UChatReasoning
              v-if="isReasoningUIPart(part)"
              icon="i-lucide-brain"
              :text="part.text"
              :streaming="isPartStreaming(part)"
            >
              <Markdown
                :value="part.text"
                :streaming="isPartStreaming(part)"
                :plugins="plugins"
                class="text-sm text-muted *:first:mt-0 *:last:mb-0"
              />
            </UChatReasoning>

            <UChatTool
              v-else-if="isToolUIPart(part) && isMessageStreaming(message)"
              v-bind="toolMeta(part)"
              :streaming="isToolStreaming(part)"
            />

            <template v-else-if="isTextUIPart(part)">
              <Markdown
                v-if="message.role === 'assistant'"
                :value="part.text"
                :streaming="isPartStreaming(part)"
                :plugins="plugins"
                class="*:first:mt-0 *:last:mb-0"
              />
              <p
                v-else
                class="whitespace-pre-wrap text-sm/6"
              >
                {{ part.text }}
              </p>
            </template>
          </template>
        </template>
      </UChatMessages>

      <div
        v-else
        class="flex flex-col gap-6"
      >
        <UPageLinks
          v-for="category in questions"
          :key="category.category"
          :title="category.category"
          :links="category.items.map((item: string) => ({ label: item, onClick: () => ask(item) }))"
        />
      </div>
    </UTheme>

    <template #footer>
      <UChatPrompt
        ref="promptRef"
        v-model="input"
        :error="error"
        :rows="2"
        :autofocus="false"
        :ui="{ root: 'rounded-lg! px-2.5' }"
        placeholder="What would you like to know?"
        @submit="onSubmit"
      >
        <template #footer>
          <div class="flex items-center justify-between w-full px-2.5">
            <span class="text-xs text-dimmed tabular-nums">{{ input.length }} / {{ MAX_INPUT }}</span>
            <UChatPromptSubmit
              :status="status"
              icon="i-lucide-corner-down-left"
              color="neutral"
              @stop="stop()"
              @reload="regenerate()"
            />
          </div>
        </template>
      </UChatPrompt>
    </template>
  </USidebar>
</template>

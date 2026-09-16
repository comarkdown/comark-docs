<script setup lang="ts">
const open = useVersionHistory()
const isProductionDeployment = useRuntimeConfig().public.vercelEnv === 'production'

const content = useDocsContent()
const route = useRoute()
const history = ref<PageHistory>()
const pending = ref(false)

const commits = computed(() => history.value?.commits ?? [])
const showBranchBadge = computed(
  () => history.value?.defaultBranch && history.value.defaultBranch !== history.value.branch
)
const branchLabel = computed(() => {
  if (!history.value) return ''
  return `${isProductionDeployment ? 'Production' : 'Preview'} · ${history.value.branch}`
})

const { github } = useAppConfig()
const commitUrl = computed(() => {
  const base = github?.url || (github?.owner && github?.name ? `https://github.com/${github.owner}/${github.name}` : '')
  return base ? `${base}/commit` : undefined
})

/** Path the current `commits` belong to, so a reopen on the same page is free. */
const loadedPath = ref<string>()

async function loadHistory() {
  const path = content.value.path
  pending.value = true
  try {
    history.value = await $fetch<PageHistory>('/api/history', { query: { path } })
  } catch {
    history.value = undefined
  } finally {
    loadedPath.value = path
    pending.value = false
  }
}

// On demand, not on mount: always mounted but starts closed, and `/api/history` isn't
// ISR-cached, so eager fetching cost every visitor a request for a panel most never open.
watch(open, (isOpen) => {
  if (isOpen && loadedPath.value !== content.value.path) loadHistory()
})

// A navigation with the panel already open refetches; otherwise just invalidate so
// the next open does.
watch(
  () => route.path,
  () => {
    if (open.value) loadHistory()
    else loadedPath.value = undefined
  }
)

function isActive(commit: PageCommit) {
  if (content.value.mode === 'blob' && content.value.ref) {
    return commit.sha === content.value.ref || commit.sha.startsWith(content.value.ref)
  }
  return content.value.mode === 'prod' && Boolean(commit.current)
}

function select(commit: PageCommit) {
  navigateTo(commit.current ? content.value.path : `/blob/${commit.sha}${content.value.path}`)
  open.value = false
}

function formatDate(date?: string) {
  if (!date) return ''
  return new Date(date).toLocaleString(undefined, { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Version history"
    side="right"
    :overlay="false"
    :modal="false"
  >
    <template #description>
      <span class="flex flex-col gap-3">
        <span class="text-2xs">{{ branchLabel }}</span>
        <span class="inline-flex items-center gap-1 text-xs text-muted">
          <UIcon
            name="i-lucide-triangle-alert"
            class="size-3 shrink-0"
          />
          Only the commits that changed this page are listed.
        </span>
      </span>
    </template>

    <template #body>
      <p
        v-if="pending"
        class="text-sm text-muted"
      >
        Loading…
      </p>

      <template v-else>
        <p
          v-if="!commits.length"
          class="text-sm text-muted"
        >
          No version history for this page.
        </p>

        <ul
          v-else
          class="space-y-1 -mx-2.5"
        >
          <li
            v-for="commit in commits"
            :key="commit.sha"
          >
            <!--
              A `div[role=button]`, not a `button`: the GitHub badges below render as real `<a>`s, and an
              anchor nested inside a native `<button>` is invalid HTML (interactive content in interactive
              content). `@keydown.stop` on those anchors keeps Enter from also bubbling up to `select()`.
            -->
            <div
              role="button"
              tabindex="0"
              class="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm"
              :class="isActive(commit) ? 'bg-elevated' : 'hover:bg-elevated/50'"
              @click="select(commit)"
              @keydown.enter="select(commit)"
              @keydown.space.prevent="select(commit)"
            >
              <span class="w-full flex flex-col gap-1">
                <span class="inline-flex items-center gap-2">
                  <span class="font-medium text-default">{{ formatDate(commit.date) }}</span>
                  <UBadge
                    v-if="commit.current"
                    color="primary"
                    size="sm"
                    label="Live"
                    class="rounded-full"
                  />
                  <UBadge
                    v-if="showBranchBadge && !commit.branchOnly"
                    :as="commitUrl ? 'a' : 'span'"
                    :href="commitUrl && `${commitUrl}/${commit.sha}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    leading-icon="i-simple-icons-github"
                    :label="history?.defaultBranch"
                    class="rounded-full"
                    @click.stop
                    @keydown.stop
                  />
                  <UBadge
                    v-if="showBranchBadge && commit.branchOnly"
                    :as="commitUrl ? 'a' : 'span'"
                    :href="commitUrl && `${commitUrl}/${commit.sha}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    leading-icon="i-simple-icons-github"
                    :label="history?.branch"
                    class="rounded-full"
                    @click.stop
                    @keydown.stop
                  />
                </span>
                <span class="block truncate text-sm text-toned">{{ commit.message }}</span>
                <UUser
                  :avatar="{
                    src: commit.avatarUrl,
                    alt: commit.author,
                    class: 'text-[10px] ' + (isActive(commit) ? 'bg-muted dark:bg-muted' : 'dark:bg-dimmed'),
                  }"
                  :name="commit.author"
                  size="2xs"
                  :ui="{ wrapper: 'gap-0' }"
                />
              </span>
            </div>
          </li>
        </ul>
      </template>
    </template>
  </USlideover>
</template>

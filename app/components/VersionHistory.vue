<script setup lang="ts">
interface PageCommit {
  sha: string
  shortSha: string
  message: string
  author?: string
  avatarUrl?: string
  date?: string
  production?: boolean
}

const open = useVersionHistory()

const cms = useCMS()
const route = useRoute()
const commits = ref<PageCommit[]>([])

async function loadHistory() {
  try {
    commits.value = await $fetch<PageCommit[]>('/api/history', { query: { path: cms.value.path } })
  } catch {
    commits.value = []
  }
}

onMounted(loadHistory)
watch(() => route.path, loadHistory)

function isActive(commit: PageCommit) {
  if (cms.value.mode === 'blob' && cms.value.ref) {
    return commit.sha === cms.value.ref || commit.sha.startsWith(cms.value.ref)
  }
  return cms.value.mode === 'prod' && Boolean(commit.production)
}

function select(commit: PageCommit) {
  navigateTo(commit.production ? cms.value.path : `/blob/${commit.sha}${cms.value.path}`)
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
    <template #body>
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
          <button
            type="button"
            class="w-full rounded-md px-3 py-2 text-left text-sm"
            :class="isActive(commit) ? 'bg-elevated' : 'hover:bg-elevated/50'"
            @click="select(commit)"
          >
            <span class="w-full flex flex-col gap-1">
              <span class="inline-flex items-center gap-2">
                <span class="font-medium text-default">{{ formatDate(commit.date) }}</span>
                <UBadge
                  v-if="commit.production"
                  color="primary"
                  size="sm"
                  label="Production"
                  class="rounded-full"
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
          </button>
        </li>
      </ul>
    </template>
  </USlideover>
</template>

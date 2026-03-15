<script setup lang="ts">
import { ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import FollowerCard from '../components/FollowerCard.vue'
import * as api from '../services/api'
import type { DiffResult } from '../types/follower'

const props = defineProps<{
  profileId: string
}>()

const { data: history, isLoading } = useQuery({
  queryKey: ['history', props.profileId],
  queryFn: api.getHistory,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
})

const selectedDiff = ref<DiffResult | null>(null)
const loadingDiffId = ref<string | null>(null)

async function viewDiff(diffId: string) {
  loadingDiffId.value = diffId
  try {
    selectedDiff.value = await api.getDiff(diffId)
  } finally {
    loadingDiffId.value = null
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div>
    <h2 class="text-lg font-bold text-gray-900 mb-5">Scan History</h2>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-16 bg-white rounded-xl border border-gray-100 animate-pulse" />
    </div>

    <!-- Empty -->
    <div v-else-if="!history?.length" class="text-center py-16 text-gray-400">
      <p class="text-2xl mb-2">📋</p>
      <p class="font-medium text-gray-600">No scans yet</p>
      <p class="text-sm mt-1">Completed scans will appear here.</p>
    </div>

    <!-- Scan list -->
    <div v-else class="grid gap-3">
      <div
        v-for="scan in history"
        :key="scan.scan_id"
        class="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow"
      >
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-800">
            {{ formatDate(scan.timestamp) }}
          </p>
          <p class="text-xs text-gray-400 mt-0.5">
            {{ scan.follower_count.toLocaleString() }} followers · {{ scan.scan_id }}
          </p>
        </div>

        <button
          v-if="scan.diff_id"
          :disabled="loadingDiffId === scan.diff_id"
          class="shrink-0 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors"
          @click="viewDiff(scan.diff_id!)"
        >
          <span
            v-if="loadingDiffId === scan.diff_id"
            class="inline-block w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-1"
          />
          View diff
        </button>
        <span v-else class="shrink-0 text-xs text-gray-400 italic">No previous scan</span>
      </div>
    </div>

    <!-- Diff detail modal -->
    <Teleport to="body">
      <div
        v-if="selectedDiff"
        class="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
        @click.self="selectedDiff = null"
      >
        <div
          class="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        >
          <!-- Modal header -->
          <div
            class="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between"
          >
            <h3 class="font-bold text-gray-900">
              {{ formatDate(selectedDiff.timestamp) }}
            </h3>
            <button
              class="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              @click="selectedDiff = null"
            >
              ✕
            </button>
          </div>

          <div class="p-6">
            <!-- Stats row -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div class="bg-emerald-50 rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-emerald-600">
                  +{{ selectedDiff.new_count }}
                </p>
                <p class="text-xs text-emerald-700 mt-1 font-medium">New Followers</p>
              </div>
              <div class="bg-rose-50 rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-rose-500">
                  −{{ selectedDiff.unfollow_count }}
                </p>
                <p class="text-xs text-rose-700 mt-1 font-medium">Unfollowers</p>
              </div>
            </div>

            <!-- New followers list -->
            <template v-if="selectedDiff.new_followers.length">
              <h4 class="text-sm font-semibold text-gray-700 mb-3">New Followers</h4>
              <div class="grid gap-2 mb-6">
                <FollowerCard
                  v-for="f in selectedDiff.new_followers"
                  :key="f.pk_id"
                  :follower="f"
                  :profile-id="props.profileId"
                  compact
                />
              </div>
            </template>

            <!-- Unfollowers list -->
            <template v-if="selectedDiff.unfollowers.length">
              <h4 class="text-sm font-semibold text-gray-700 mb-3">Unfollowers</h4>
              <div class="grid gap-2">
                <FollowerCard
                  v-for="f in selectedDiff.unfollowers"
                  :key="f.pk_id"
                  :follower="f"
                  :profile-id="props.profileId"
                  compact
                />
              </div>
            </template>

            <!-- Nothing in diff -->
            <p
              v-if="!selectedDiff.new_followers.length && !selectedDiff.unfollowers.length"
              class="text-center text-gray-400 py-6 text-sm"
            >
              No changes recorded for this scan.
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Dashboard from "./views/Dashboard.vue";
import HistoryView from "./views/HistoryView.vue";

const currentView = ref<"dashboard" | "history">("dashboard");
</script>

<template>
    <div class="min-h-screen bg-gray-50 text-gray-900">
        <!-- Top navigation -->
        <nav
            class="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 shadow-sm"
        >
            <div class="max-w-3xl mx-auto flex items-center justify-between">
                <span class="text-lg font-bold tracking-tight"
                    >📊 Follower Tracker</span
                >
                <div class="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    <button
                        v-for="(label, view) in {
                            dashboard: 'Dashboard',
                            history: 'History',
                        }"
                        :key="view"
                        :class="
                            currentView === view
                                ? 'bg-white shadow text-gray-900'
                                : 'text-gray-500 hover:text-gray-700'
                        "
                        class="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
                        @click="currentView = view as 'dashboard' | 'history'"
                    >
                        {{ label }}
                    </button>
                </div>
            </div>
        </nav>

        <main class="max-w-3xl mx-auto px-6 py-8">
            <Dashboard v-if="currentView === 'dashboard'" />
            <HistoryView v-else />
        </main>
    </div>
</template>

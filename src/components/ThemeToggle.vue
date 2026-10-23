<script setup lang="ts">
import { computed } from 'vue'
import { useTheme, type ThemeMode } from '../stores/theme'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const { mode, setMode } = useTheme()

const options: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
  { key: 'system', label: '跟随系统' },
]

const current = computed(() => mode.value)
</script>

<template>
  <div class="theme-toggle" :class="{ compact }" role="group" aria-label="主题">
    <button
      v-for="o in options"
      :key="o.key"
      class="opt"
      :class="{ on: current === o.key }"
      :title="o.label"
      :aria-pressed="current === o.key"
      @click="setMode(o.key)"
    >
      <svg v-if="o.key === 'light'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" stroke-linecap="round" />
      </svg>
      <svg v-else-if="o.key === 'dark'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" stroke-linejoin="round" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="7.4" />
        <path d="M12 4.6v14.8A7.4 7.4 0 0 0 12 4.6Z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--line-hi);
  background: var(--glass);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-soft);
}

.compact .opt {
  width: 26px;
  height: 24px;
}

.opt {
  width: 30px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: var(--text-4);
  transition: all 0.18s ease;
}

.opt:hover {
  color: var(--text);
}

.opt.on {
  color: var(--btn-text-on-accent);
  background: var(--accent-grad);
}
</style>

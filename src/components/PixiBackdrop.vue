<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { backdrop } from '../render/pixi/backdrop'
import { useTheme } from '../stores/theme'

const host = ref<HTMLElement | null>(null)
const { resolved } = useTheme()

onMounted(async () => {
  if (!host.value) return
  await backdrop.attach(host.value, resolved.value)
})

watch(resolved, (t) => backdrop.setTheme(t))

onBeforeUnmount(() => {
  /* 整个应用生命周期内保持，不销毁 */
})
</script>

<template>
  <div ref="host" class="pixi-host" aria-hidden="true" />
</template>

<style scoped>
.pixi-host {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  opacity: 0;
  animation: fade-in 1.1s ease 0.15s forwards;
}
</style>

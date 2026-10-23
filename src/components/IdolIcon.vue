<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { drawAvatarRound } from '../render/avatar'
import { IDOL_BY_ID } from '../data/idols'
import { useTheme } from '../stores/theme'

const props = withDefaults(defineProps<{ id: string; size?: number }>(), { size: 44 })
const canvas = ref<HTMLCanvasElement | null>(null)
const { resolved } = useTheme()

function render() {
  if (!canvas.value) return
  const def = IDOL_BY_ID.get(props.id)
  if (!def) return
  drawAvatarRound(canvas.value, def, props.size)
}

onMounted(render)
watch(() => [props.id, props.size], render)
watch(resolved, render)
</script>

<template>
  <canvas ref="canvas" class="icon" />
</template>

<style scoped>
.icon {
  display: block;
  border-radius: 50%;
}
</style>

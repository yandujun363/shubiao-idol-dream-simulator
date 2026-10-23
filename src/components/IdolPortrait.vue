<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { drawAvatar } from '../render/avatar'
import { IDOL_BY_ID } from '../data/idols'
import { useTheme } from '../stores/theme'

const props = withDefaults(defineProps<{ id: string; size?: number; bg?: number; animate?: boolean }>(), {
  size: 240,
  bg: 1,
  animate: true,
})

const canvas = ref<HTMLCanvasElement | null>(null)
const { resolved } = useTheme()
let blinkTimer: number | undefined
let blinkOffTimer: number | undefined

function render(blink = false) {
  if (!canvas.value) return
  const def = IDOL_BY_ID.get(props.id)
  if (!def) return
  drawAvatar(canvas.value, def, {
    size: props.size,
    blink,
    bgOpacity: props.bg,
    theme: resolved.value,
  })
  canvas.value.style.width = '100%'
  canvas.value.style.height = 'auto'
}

function scheduleBlink() {
  if (!props.animate) return
  blinkTimer = window.setTimeout(() => {
    render(true)
    blinkOffTimer = window.setTimeout(() => {
      render(false)
      scheduleBlink()
    }, 130)
  }, 2600 + Math.random() * 4200)
}

onMounted(() => {
  render()
  scheduleBlink()
})

onBeforeUnmount(() => {
  clearTimeout(blinkTimer)
  clearTimeout(blinkOffTimer)
})

watch(
  () => [props.id, props.size, props.bg],
  () => render(),
)

watch(resolved, () => render())
</script>

<template>
  <canvas ref="canvas" class="portrait" />
</template>

<style scoped>
.portrait {
  display: block;
  width: 100%;
  height: auto;
}
</style>

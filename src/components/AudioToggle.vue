<script setup lang="ts">
import { useGameStore } from '../stores/game'
import { audio } from '../audio/engine'
import { audioOn, toggleAudio } from '../stores/ui'

const game = useGameStore()

function onClick() {
  toggleAudio()
  // 只负责把音频上下文拉起来，具体放哪一首由 App 里的 mood watch 决定
  if (audioOn.value) void audio.init()
  game.notify(audioOn.value ? '声音：开' : '声音：关')
}
</script>

<template>
  <button class="audio-toggle" :class="{ off: !audioOn }" :title="audioOn ? '关闭声音' : '开启声音'" @click.stop="onClick">
    <svg v-if="audioOn" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 9v6h3l5 4V5L7 9H4z" />
      <path d="M16 8.5a5 5 0 0 1 0 7" stroke-linecap="round" />
      <path d="M18.6 6a8.5 8.5 0 0 1 0 12" stroke-linecap="round" />
    </svg>
    <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 9v6h3l5 4V5L7 9H4z" />
      <path d="M16 9l5 6M21 9l-5 6" stroke-linecap="round" />
    </svg>
  </button>
</template>

<style scoped>
.audio-toggle {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--line-hi);
  background: var(--glass);
  color: var(--text-3);
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}
.audio-toggle:hover {
  color: var(--gold);
  border-color: var(--gold-line);
}
.audio-toggle.off {
  color: var(--text-4);
}
</style>

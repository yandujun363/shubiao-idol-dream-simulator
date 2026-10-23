<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import TitleScreen from './views/TitleScreen.vue'
import GameScreen from './views/GameScreen.vue'
import LiveStage from './views/LiveStage.vue'
import EndingScreen from './views/EndingScreen.vue'
import PixiBackdrop from './components/PixiBackdrop.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import AudioToggle from './components/AudioToggle.vue'
import { useGameStore } from './stores/game'
import { useTheme } from './stores/theme'
import { audioOn } from './stores/ui'
import { audio, type Mood } from './audio/engine'
import { backdrop } from './render/pixi/backdrop'

const game = useGameStore()
const { resolved } = useTheme()
const booted = ref(false)

const mood = computed<Mood>(() => {
  if (!audioOn.value) return 'silent'
  if (game.screen === 'title') return 'title'
  if (game.screen === 'live') return 'live'
  if (game.screen === 'ending') return game.ending?.music === 'sad' ? 'sad' : 'victory'
  const lowMoney = game.gs.resources.money < game.fixedCost * 0.6
  const lowMorale = game.avgMorale < 28
  if (lowMoney || lowMorale) return 'tense'
  if (game.gs.phase === 2 || game.gs.endless) return 'build'
  return 'day'
})

let unlocked = false

async function unlock() {
  if (unlocked) return
  unlocked = true
  await audio.init()
  audio.setMood(mood.value)
  booted.value = true
}

watch(mood, (m) => {
  if (audioOn.value) audio.setMood(m)
})

watch(resolved, (t) => backdrop.setTheme(t))

onMounted(() => {
  const q = new URLSearchParams(window.location.search)
  if (q.get('preview') === 'stage') {
    game.previewStage({
      fans: q.get('fans') ? Number(q.get('fans')) : undefined,
      threeD: q.get('threed') ? Number(q.get('threed')) : undefined,
    })
  }

  const handler = () => {
    void unlock()
  }
  window.addEventListener('pointerdown', handler, { once: true })
  window.addEventListener('keydown', handler, { once: true })
})
</script>

<template>
  <div class="app-root" :class="{ booted }">
    <PixiBackdrop />

    <div class="screen-layer">
      <Transition name="screen" mode="out-in">
        <TitleScreen v-if="game.screen === 'title'" key="title" />
        <GameScreen v-else-if="game.screen === 'game'" key="game" />
        <LiveStage v-else-if="game.screen === 'live'" key="live" />
        <EndingScreen v-else key="ending" />
      </Transition>
    </div>

    <div v-if="game.screen !== 'game'" class="dock">
      <ThemeToggle />
      <AudioToggle />
    </div>

    <Transition name="toast">
      <div v-if="game.toast" class="toast">{{ game.toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.app-root {
  position: relative;
  height: 100%;
  transition: filter 0.9s ease;
}
/* 首次交互（解锁音频）后，界面从偏冷恢复到正常 */
.app-root:not(.booted) {
  filter: saturate(0.86) brightness(0.99);
}

.screen-layer {
  position: relative;
  z-index: 1;
  height: 100%;
}

.dock {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 8px;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  z-index: 95;
  padding: 9px 20px;
  border-radius: 999px;
  background: var(--glass);
  border: 1px solid var(--line-hi);
  color: var(--text);
  font-size: 13px;
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(10px);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

.screen-enter-active,
.screen-leave-active {
  transition: opacity 0.32s ease, transform 0.32s ease;
}
.screen-enter-from {
  opacity: 0;
  transform: scale(0.995);
}
.screen-leave-to {
  opacity: 0;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import TopBar from '../components/TopBar.vue'
import Roster from '../components/Roster.vue'
import LogFeed from '../components/LogFeed.vue'
import OrderPanel from '../components/OrderPanel.vue'
import ActionPicker from '../components/ActionPicker.vue'
import EventModal from '../components/EventModal.vue'
import IdolDetail from '../components/IdolDetail.vue'
import DataPanel from '../components/DataPanel.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import AudioToggle from '../components/AudioToggle.vue'
import { audio } from '../audio/engine'

const game = useGameStore()
const pickerOpen = ref(false)
const dataOpen = ref(false)
const detailId = ref<string | null>(null)

const seasonTitle = computed(() => {
  if (game.gs.endless) return `无限流 · 第 ${game.gs.endlessMonth} 月`
  return game.seasonLabel
})

function openPicker() {
  audio.sfx('click')
  pickerOpen.value = true
}

function execute() {
  audio.sfx('confirm')
  void game.executeMonth()
}

function selectIdol(id: string) {
  audio.sfx('pop')
  detailId.value = id
}

function openData() {
  audio.sfx('click')
  dataOpen.value = true
}
</script>

<template>
  <div class="game">
    <TopBar />

    <div class="main">
      <Roster @select="selectIdol" />

      <section class="center">
        <div class="chapter">
          <div class="ch-left">
            <span class="ch-k mono">CHAPTER</span>
            <h2 class="ch-title serif">{{ seasonTitle }}</h2>
          </div>
          <div class="ch-right">
            <button class="mini" @click="openData">数据表</button>
            <button class="mini" @click="game.backToTitle()">标题</button>
            <ThemeToggle compact />
            <AudioToggle />
          </div>
        </div>

        <LogFeed />
      </section>

      <OrderPanel @open-picker="openPicker" @execute="execute" />
    </div>

    <ActionPicker :open="pickerOpen" @close="pickerOpen = false" />
    <DataPanel :open="dataOpen" @close="dataOpen = false" />
    <IdolDetail :id="detailId" @close="detailId = null" />
    <EventModal />
  </div>
</template>

<style scoped>
.game {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.main {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}

.center {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.chapter {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 14px 26px 10px;
  border-bottom: 1px solid var(--line);
  flex: 0 0 auto;
}

.ch-k {
  font-size: 8.5px;
  letter-spacing: 0.32em;
  color: var(--dimmer);
}

.ch-title {
  font-size: 19px;
  letter-spacing: 0.1em;
  font-weight: 500;
  margin-top: 1px;
  background: linear-gradient(100deg, var(--ink), var(--violet) 60%, var(--gold));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.ch-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini {
  font-size: 11px;
  padding: 4px 11px;
  border-radius: 7px;
  border: 1px solid var(--line);
  color: var(--dim);
  transition: all 0.16s ease;
}
.mini:hover {
  color: var(--text);
  border-color: var(--line-hi);
  background: var(--panel);
}

@media (max-width: 900px) {
  .main {
    flex-direction: column;
    overflow-y: auto;
  }
  .main :deep(.roster) {
    width: 100%;
    flex: 0 0 auto;
    border-right: none;
    border-bottom: 1px solid var(--line);
  }
  .main :deep(.roster .list) {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 10px 10px;
  }
  .main :deep(.roster .card) {
    min-width: 172px;
    flex: 0 0 auto;
  }
  .main :deep(.orders) {
    width: 100%;
    flex: 0 0 auto;
    border-left: none;
    border-top: 1px solid var(--line);
    max-height: 46vh;
  }
  .center {
    min-height: 44vh;
  }
  .chapter {
    padding: 10px 14px 8px;
  }
  .ch-title {
    font-size: 16px;
  }
}
</style>

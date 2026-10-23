<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { fmtMoney } from '../engine/balance'

const game = useGameStore()

const event = computed(() => game.currentEvent)
const options = computed(() => game.eventOptions)

function choose(i: number) {
  game.chooseEvent(i)
}
</script>

<template>
  <Transition name="evt">
    <div v-if="event" class="overlay">
      <div class="card panel">
        <div class="ribbon" />
        <header class="head">
          <div class="section-title">EVENT · 突发状况</div>
          <h2 class="title serif">{{ event.title }}</h2>
        </header>

        <div class="body">
          <template v-for="(l, i) in game.eventBody" :key="i">
            <p v-if="l.kind === 'narration' || l.kind === 'good' || l.kind === 'bad'" class="e-text serif" :class="l.kind">
              {{ l.text }}
            </p>
            <p v-else-if="l.kind === 'quote'" class="e-quote serif">
              {{ l.text }}<span v-if="l.who" class="e-who mono">— {{ l.who }}</span>
            </p>
          </template>
        </div>

        <div class="choices">
          <button
            v-for="(o, i) in options"
            :key="i"
            class="choice"
            :disabled="o.disabled"
            @click="choose(i)"
          >
            <div class="c-main">
              <span class="c-label serif">{{ o.label }}</span>
              <span v-if="o.hint" class="c-hint">{{ o.hint }}</span>
            </div>
            <div class="c-right">
              <span v-if="o.cost" class="c-cost mono" :class="{ neg: o.disabled }">
                ¥{{ fmtMoney(o.cost) }}
              </span>
              <span class="c-arrow">→</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>

.card {
  position: relative;
  width: min(620px, 100%);
  padding: 26px 28px 22px;
  background: var(--sheet);
  border-color: rgba(255, 134, 200, 0.28);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.7), 0 0 60px rgba(255, 134, 200, 0.09);
  animation: pop-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
  overflow: hidden;
}

.ribbon {
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #ff86c8, #ffcf6b, transparent);
}

.head {
  margin-bottom: 18px;
}

.title {
  margin-top: 6px;
  font-size: 25px;
  letter-spacing: 0.1em;
  color: var(--pink);
  text-shadow: 0 0 34px rgba(255, 134, 200, 0.4);
}

.body {
  max-height: 34vh;
  overflow-y: auto;
  margin-bottom: 18px;
  padding-right: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.e-text {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.95;
  color: var(--text-2);
  white-space: pre-wrap;
}
.e-text.good {
  color: var(--green);
}
.e-text.bad {
  color: var(--red-soft);
}

.e-quote {
  margin: 4px 0;
  padding-left: 12px;
  border-left: 2px solid rgba(255, 207, 107, 0.4);
  font-size: 14px;
  font-style: italic;
  color: var(--warm);
}
.e-who {
  font-size: 10px;
  color: var(--dimmer);
  margin-left: 6px;
  font-style: normal;
}

.choices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.choice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 16px;
  border-radius: 11px;
  border: 1px solid var(--line);
  background: var(--wash-2);
  text-align: left;
  transition: all 0.18s ease;
}

.choice:hover:not(:disabled) {
  border-color: var(--gold-line);
  background: var(--gold-bg);
  transform: translateX(3px);
}

.c-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.c-label {
  font-size: 15px;
  letter-spacing: 0.04em;
}

.c-hint {
  font-size: 11px;
  color: var(--dim);
}

.c-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.c-cost {
  font-size: 11.5px;
  color: var(--gold);
}
.c-cost.neg {
  color: var(--red);
}

.c-arrow {
  color: var(--dimmer);
  font-size: 13px;
}

.evt-enter-active,
.evt-leave-active {
  transition: opacity 0.24s ease;
}
.evt-enter-from,
.evt-leave-to {
  opacity: 0;
}
</style>

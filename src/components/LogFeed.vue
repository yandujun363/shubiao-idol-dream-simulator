<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useGameStore } from '../stores/game'

const game = useGameStore()
const scroller = ref<HTMLElement | null>(null)
const stick = ref(true)

function onScroll() {
  const el = scroller.value
  if (!el) return
  stick.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

async function toBottom() {
  if (!stick.value) return
  await nextTick()
  const el = scroller.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(() => game.logs.length, toBottom)
onMounted(toBottom)
</script>

<template>
  <div ref="scroller" class="feed" @scroll.passive="onScroll">
    <div class="feed-inner">
      <TransitionGroup name="log">
        <div v-for="(l, i) in game.logs" :key="i" class="line" :class="l.kind">
          <template v-if="l.kind === 'action'">
            <span class="mark">◆</span>
            <span class="act-name serif">{{ l.text }}</span>
            <span v-if="l.who" class="who mono">{{ l.who }}</span>
          </template>
          <template v-else-if="l.kind === 'event'">
            <div class="event-banner">
              <span class="event-title serif">{{ l.text }}</span>
            </div>
          </template>
          <template v-else-if="l.kind === 'quote'">
            <div class="quote">
              <p class="serif">{{ l.text }}</p>
              <span v-if="l.who" class="quote-who mono">— {{ l.who }}</span>
            </div>
          </template>
          <template v-else-if="l.kind === 'ledger'">
            <div class="ledger">
              <div class="ledger-head mono">{{ l.text }}</div>
              <div v-for="(row, ri) in l.rows" :key="ri" class="lrow" :class="row.tone">
                <span class="lk">{{ row.label }}</span>
                <span class="lv mono">{{ row.value }}</span>
              </div>
            </div>
          </template>
          <template v-else-if="l.kind === 'system'">
            <div class="sys">{{ l.text }}</div>
          </template>
          <template v-else-if="l.kind === 'result'">
            <div class="result mono">{{ l.text }}</div>
          </template>
          <template v-else>
            <p class="text serif" :class="l.kind">
              <span v-if="l.who" class="who mono">{{ l.who }}：</span>{{ l.text }}
            </p>
          </template>
        </div>
      </TransitionGroup>

      <div v-if="game.phase === 'resolving'" class="working">
        <span class="dot" /><span class="dot" /><span class="dot" />
        <span class="mono">企划执行中…</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feed {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 22px 26px 40px;
  scroll-behavior: smooth;
}

.feed-inner {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.line {
  animation: fade-up 0.36s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.text {
  margin: 0;
  font-size: 15px;
  line-height: 1.95;
  color: var(--text-2);
  white-space: pre-wrap;
  letter-spacing: 0.01em;
}

.text.narration {
  color: var(--text-2);
}

.text.good {
  color: var(--green);
}

.text.bad {
  color: var(--red-soft);
}

.who {
  font-size: 11px;
  color: var(--dimmer);
  letter-spacing: 0.06em;
  margin-right: 2px;
}

.line.action {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  padding-top: 10px;
  border-top: 1px dashed var(--line-soft);
}

.mark {
  color: var(--gold);
  font-size: 10px;
}

.act-name {
  font-size: 16px;
  letter-spacing: 0.08em;
  color: var(--gold);
}

.line.action .who {
  margin-left: auto;
}

.event-banner {
  margin: 22px 0 6px;
  padding: 14px 0;
  text-align: center;
  position: relative;
}

.event-banner::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(closest-side, rgba(255, 134, 200, 0.14), transparent);
  pointer-events: none;
}

.event-title {
  position: relative;
  font-size: 18px;
  letter-spacing: 0.22em;
  color: var(--pink);
  text-shadow: 0 0 26px rgba(255, 134, 200, 0.5);
}

.quote {
  margin: 6px 0;
  padding: 2px 0 2px 14px;
  border-left: 2px solid rgba(255, 207, 107, 0.4);
}

.quote p {
  margin: 0;
  font-size: 15px;
  line-height: 1.9;
  color: var(--warm);
  font-style: italic;
}

.quote-who {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--dimmer);
  letter-spacing: 0.1em;
}

.ledger {
  margin: 10px 0 4px;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  background: var(--wash-1);
}

.ledger-head {
  padding: 6px 12px;
  font-size: 9.5px;
  letter-spacing: 0.22em;
  color: var(--dimmer);
  background: var(--wash-2);
  border-bottom: 1px solid var(--line);
}

.lrow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 12px;
  font-size: 11.5px;
}

.lrow .lk {
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lrow .lv {
  flex: 0 0 auto;
  font-size: 11.5px;
  color: var(--text);
}

.lrow.sub .lk,
.lrow.sub .lv {
  color: var(--dimmer);
  font-size: 10.5px;
}

.lrow.in .lv {
  color: var(--green);
}

.lrow.out .lv {
  color: var(--red-soft);
}

.lrow.total {
  border-top: 1px dashed var(--line);
  margin-top: 2px;
  padding-top: 6px;
  padding-bottom: 7px;
}

.lrow.total .lk {
  color: var(--text);
  font-weight: 600;
}

.lrow.total .lv {
  color: var(--gold);
  font-weight: 600;
  font-size: 13px;
}

.sys {
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--dimmer);
  padding: 3px 10px;
  border-radius: 6px;
  background: var(--wash-2);
  border-left: 2px solid var(--violet);
  font-family: var(--mono);
  white-space: pre-wrap;
}

.result {
  font-size: 12px;
  color: var(--gold);
  letter-spacing: 0.04em;
  padding-left: 2px;
}

.working {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 4px;
  color: var(--dimmer);
  font-size: 11px;
  letter-spacing: 0.1em;
}

.working .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--gold);
  animation: breathe 1s ease-in-out infinite;
}
.working .dot:nth-child(2) {
  animation-delay: 0.15s;
}
.working .dot:nth-child(3) {
  animation-delay: 0.3s;
  margin-right: 6px;
}

.log-enter-active {
  transition: none;
}

@media (max-width: 900px) {
  .feed {
    padding: 16px 16px 30px;
  }
  .text {
    font-size: 14px;
    line-height: 1.85;
  }
}
</style>

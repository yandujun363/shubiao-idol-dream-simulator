<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { ACTION_BY_ID } from '../data/actions'
import { IDOL_BY_ID } from '../data/idols'
import { CONFIG, fmtMoney, fmtNum } from '../engine/balance'
import { MOUSE_QUOTES } from '../data/narration'

const emit = defineEmits<{ openPicker: []; execute: [] }>()
const game = useGameStore()

const rows = computed(() =>
  game.gs.pending.map((p) => {
    const def = ACTION_BY_ID.get(p.actionId)!
    const pv = game.previewOf(p)
    return {
      p,
      def,
      pv,
      names: p.targets.map((id) => IDOL_BY_ID.get(id)!.nick),
    }
  }),
)

const quote = computed(() => MOUSE_QUOTES[game.gs.month % MOUSE_QUOTES.length])

const busy = computed(() => game.phase !== 'idle')

const cut = computed(() => game.gs.resources.guildCut)
const cutPct = computed(() => Math.round(cut.value * 100))
const platformPct = Math.round(CONFIG.revenue.platformCut * 100)

const cutRange = {
  min: CONFIG.revenue.guildCutMin,
  max: CONFIG.revenue.guildCutMax,
  step: CONFIG.revenue.guildCutStep,
}

const cutTone = computed(() => {
  const d = game.cutMoraleHint.delta
  if (Math.abs(d) < 1) return 'fair'
  if (d < -3) return 'greedy'
  if (d < 0) return 'high'
  return 'soft'
})

function onCut(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  game.setGuildCut(v)
}

const warnings = computed(() => {
  const w: { text: string; tone: 'warn' | 'bad' }[] = []
  const m = game.gs.resources.money - game.pendingCost
  if (m < 0) w.push({ text: '资金不足以执行这些行动', tone: 'bad' })
  else if (m < game.fixedCost) w.push({ text: '执行后资金撑不过下个月', tone: 'bad' })
  const tired = game.gs.idols.filter((i) => i.fatigue > 82)
  if (tired.length) w.push({ text: `${tired.map((i) => IDOL_BY_ID.get(i.id)!.nick).join('、')} 疲劳过高，可能病倒`, tone: 'bad' })
  const lowMorale = game.gs.idols.filter((i) => i.morale < 22)
  if (lowMorale.length) w.push({ text: `${lowMorale.map((i) => IDOL_BY_ID.get(i.id)!.nick).join('、')} 心态危险`, tone: 'warn' })
  const risky = game.gs.idols.filter((i) => i.gradRisk >= 0)
  if (risky.length) w.push({ text: `${risky.map((i) => IDOL_BY_ID.get(i.id)!.nick).join('、')} 正在考虑毕业`, tone: 'bad' })
  return w
})
</script>

<template>
  <aside class="orders">
    <div class="policy">
      <div class="p-head">
        <span class="section-title">运营方针</span>
        <span class="p-cut mono" :class="cutTone">{{ cutPct }}%</span>
      </div>
      <input
        class="slider"
        type="range"
        :min="cutRange.min"
        :max="cutRange.max"
        :step="cutRange.step"
        :value="cut"
        :disabled="busy"
        :class="cutTone"
        @input="onCut"
      />
      <div class="p-legend mono">
        <span>{{ Math.round(cutRange.min * 100) }}%</span>
        <span class="p-fair">公平线 {{ Math.round(CONFIG.revenue.guildCut.fair * 100) }}%</span>
        <span>{{ Math.round(cutRange.max * 100) }}%</span>
      </div>
      <div class="p-rows">
        <div class="p-row">
          <span>平台先抽</span>
          <b class="mono out">-{{ platformPct }}%</b>
        </div>
        <div class="p-row">
          <span>公会月收（预估）</span>
          <b class="mono in">¥{{ fmtMoney(game.revenuePreview.agency) }}</b>
        </div>
        <div class="p-row">
          <span>主播到手合计</span>
          <b class="mono">¥{{ fmtMoney(game.revenuePreview.idols) }}</b>
        </div>
        <div class="p-row">
          <span>成员心情</span>
          <b class="mono" :class="game.cutMoraleHint.delta >= 0 ? 'in' : 'out'">
            {{ game.cutMoraleHint.delta >= 0 ? '+' : '' }}{{ game.cutMoraleHint.delta.toFixed(1) }}/月
            <em>上限 {{ game.cutMoraleHint.ceiling }}</em>
          </b>
        </div>
      </div>
      <p class="p-hint">
        平台先抽 {{ platformPct }}%，剩下的里面公会抽 {{ cutPct }}%。抽得越多进账越多，
        但她们会记住——涨粉变慢、口碑变差、心态有天花板。
      </p>
    </div>

    <div class="head">
      <span class="section-title">本月编成</span>
      <button v-if="game.gs.pending.length" class="clear mono" :disabled="busy" @click="game.clearPending()">
        清空
      </button>
    </div>

    <div class="trend mono">
      <span class="tr-k">风向</span>
      <span class="tr-hot">↑ {{ game.trend.hot.name }}</span>
      <span class="tr-cold">↓ {{ game.trend.cold.name }}</span>
    </div>

    <div class="list">
      <div v-if="!rows.length" class="empty">
        <div class="empty-icon">◌</div>
        <p>本月还没有安排任何行动。</p>
        <p class="mono quote">{{ quote }}</p>
      </div>

      <TransitionGroup name="order">
        <div v-for="r in rows" :key="r.p.uid" class="order" :style="{ '--ap': r.def.ap }">
          <div class="o-top">
            <span class="o-name serif">{{ r.def.name }}</span>
            <span class="o-ap mono">{{ r.def.ap }}AP</span>
            <button class="o-x" :disabled="busy" @click="game.removePending(r.p.uid)">✕</button>
          </div>
          <div class="o-who mono">{{ r.names.length ? r.names.join('、') : '企划级' }}</div>
          <div class="o-foot mono">
            <span>{{ r.pv.fans >= 0 ? '+' : '' }}{{ fmtNum(r.pv.fans) }} 粉</span>
            <span :class="{ gain: r.pv.money > 0 }">
              {{ r.pv.money === 0 ? '免费' : `${r.pv.money > 0 ? '+' : '-'}¥${fmtMoney(Math.abs(r.pv.money))}` }}
            </span>
          </div>
          <div v-if="r.pv.fansHigh > r.pv.fans" class="o-range mono">
            发挥区间 {{ fmtNum(r.pv.fansLow) }} ~ {{ fmtNum(r.pv.fansHigh) }}
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div class="foot">
      <div class="totals">
        <div class="t-row">
          <span>已用行动点</span>
          <b class="mono">{{ game.usedAp }} / {{ game.gs.resources.apMax }}</b>
        </div>
        <div class="t-row">
          <span>预计支出</span>
          <b class="mono">¥{{ fmtMoney(game.pendingCost) }}</b>
        </div>
        <div class="t-row">
          <span>执行后余额</span>
          <b class="mono" :class="{ neg: game.gs.resources.money - game.pendingCost < 0 }">
            ¥{{ fmtMoney(game.gs.resources.money - game.pendingCost) }}
          </b>
        </div>
      </div>

      <div v-if="game.monthSummary" class="last-month mono">
        上月结余 {{ game.monthSummary.net >= 0 ? '+' : '' }}{{ fmtMoney(game.monthSummary.net) }}
      </div>

      <div v-for="(w, i) in warnings" :key="i" class="warn" :class="w.tone">
        <span class="dot" />{{ w.text }}
      </div>

      <button class="btn add" :disabled="busy && game.phase !== 'event'" @click="emit('openPicker')">
        + 安排行动
      </button>
      <button
        class="btn btn-primary exec"
        :disabled="busy || !game.gs.pending.length"
        @click="emit('execute')"
      >
        {{ busy ? '执行中…' : '执行本月计划' }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.orders {
  width: 300px;
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--line);
  background: linear-gradient(180deg, var(--wash-1), transparent 55%);
  min-height: 0;
}

.policy {
  flex: 0 0 auto;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--line);
  background: var(--wash-1);
}

.p-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.p-cut {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.p-cut.fair {
  color: var(--green);
}
.p-cut.high {
  color: var(--gold);
}
.p-cut.soft {
  color: var(--cyan);
}
.p-cut.greedy {
  color: var(--red);
  animation: breathe 1.4s ease-in-out infinite;
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, #6fe3ff, #5ee0a8 40%, #ffcf6b 68%, #ff6b81);
  outline: none;
  cursor: grab;
}
.slider:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(0, 0, 0, 0.35);
  box-shadow: 0 0 10px var(--accent-glow);
  cursor: grab;
}
.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(0, 0, 0, 0.35);
  cursor: grab;
}

.p-legend {
  display: flex;
  justify-content: space-between;
  font-size: 8.5px;
  color: var(--dimmer);
  margin-top: 5px;
}

.p-fair {
  color: var(--green);
  opacity: 0.85;
}

.p-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
}

.p-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 10.5px;
  color: var(--dim);
}

.p-row b {
  font-size: 11.5px;
  color: var(--text);
}
.p-row b.in {
  color: var(--green);
}
.p-row b.out {
  color: var(--red-soft);
}
.p-row b em {
  font-style: normal;
  font-size: 9px;
  color: var(--dimmer);
  margin-left: 4px;
}

.p-hint {
  margin: 8px 0 0;
  font-size: 9.5px;
  line-height: 1.55;
  color: var(--dimmer);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
}

.clear {
  font-size: 10px;
  color: var(--dimmer);
  letter-spacing: 0.1em;
}
.clear:hover {
  color: var(--red-soft);
}

.list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.empty {
  text-align: center;
  padding: 30px 12px;
  color: var(--dimmer);
}
.empty-icon {
  font-size: 26px;
  opacity: 0.4;
  margin-bottom: 8px;
}
.empty p {
  margin: 3px 0;
  font-size: 12px;
}
.quote {
  font-size: 10.5px;
  color: var(--text-4);
  margin-top: 10px !important;
  line-height: 1.7;
}

.order {
  padding: 9px 11px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--wash-2);
  animation: fade-up 0.3s ease both;
}

.o-top {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.o-name {
  font-size: 13.5px;
  letter-spacing: 0.05em;
  color: var(--gold);
}
.o-ap {
  font-size: 9px;
  color: var(--dimmer);
}
.o-x {
  margin-left: auto;
  font-size: 10px;
  color: var(--dimmer);
}
.o-x:hover:not(:disabled) {
  color: var(--red-soft);
}

.o-who {
  font-size: 9.5px;
  color: var(--dim);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.o-foot .gain {
  color: var(--green);
}

.o-foot {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: var(--dimmer);
  margin-top: 4px;
}

.foot {
  flex: 0 0 auto;
  padding: 12px 14px 16px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.totals {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--wash-1);
}
.t-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--dim);
}
.t-row b {
  color: var(--text);
  font-size: 12px;
}
.t-row b.neg {
  color: var(--red);
}

.last-month {
  font-size: 10px;
  color: var(--dimmer);
  text-align: center;
}

.warn {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 10.5px;
  line-height: 1.5;
  padding: 5px 8px;
  border-radius: 7px;
}
.warn .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  margin-top: 5px;
  flex: 0 0 auto;
}
.warn.warn {
  color: var(--amber);
  background: var(--warn-bg);
}
.warn.warn .dot {
  background: var(--amber);
}
.warn.bad {
  color: var(--red-soft);
  background: var(--danger-bg);
}
.warn.bad .dot {
  background: var(--red);
  animation: breathe 1.1s ease-in-out infinite;
}

.add {
  padding: 9px;
  font-size: 12.5px;
  border-style: dashed;
}

.exec {
  padding: 11px;
  font-size: 14px;
}

.order-enter-active,
.order-leave-active {
  transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.order-enter-from,
.order-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

@media (max-width: 1100px) {
  .orders {
    width: 260px;
    flex-basis: 260px;
  }
}
</style>

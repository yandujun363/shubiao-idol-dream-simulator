<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { IDOL_BY_ID } from '../data/idols'
import { STAT_LABELS, type StatKey } from '../engine/types'
import { CONFIG, fmtNum, idolTakeHome, revenueSplit } from '../engine/balance'
import IdolPortrait from './IdolPortrait.vue'

const props = defineProps<{ id: string | null }>()
const emit = defineEmits<{ close: [] }>()
const game = useGameStore()

const def = computed(() => (props.id ? IDOL_BY_ID.get(props.id)! : null))
const st = computed(() => (props.id ? game.gs.idols.find((i) => i.id === props.id)! : null))

const STATS: StatKey[] = ['vocal', 'dance', 'talk', 'charm']

const eff = computed(() => {
  if (!props.id) return {} as Record<StatKey, number>
  return Object.fromEntries(STATS.map((k) => [k, game.effOf(props.id!, k)])) as Record<StatKey, number>
})

const takeHome = computed(() => {
  if (!props.id || !st.value) return { base: 0, share: 0, total: 0 }
  const total = game.gs.idols.reduce((a, i) => a + i.fans, 0)
  const split = revenueSplit(
    total,
    game.gs.resources.reputation,
    game.gs.resources.guildCut,
    game.gs.merchLevel,
  )
  const base = CONFIG.economy.salaryPerIdol
  return {
    base,
    share: split.idols * (total > 0 ? st.value.fans / total : 0),
    total: idolTakeHome(st.value.fans, total, split.idols, base),
  }
})

const rank = computed(() => {
  if (!st.value) return ''
  const total = STATS.reduce((s, k) => s + st.value!.stats[k], 0)
  if (total > 250) return 'S'
  if (total > 210) return 'A'
  if (total > 175) return 'B'
  if (total > 140) return 'C'
  return 'D'
})
</script>

<template>
  <Transition name="detail">
    <div v-if="def && st" class="overlay" @click.self="emit('close')">
      <div class="card panel" :style="{ '--c': def.color }">
        <button class="x" @click="emit('close')">✕</button>

        <div class="left">
          <div class="portrait-wrap">
            <IdolPortrait :id="def.id" :size="260" />
            <div class="glow" />
          </div>
          <div class="rank mono">RANK {{ rank }}</div>
        </div>

        <div class="right">
          <div class="line-badge mono">
            {{ def.line === 'light' ? '光芒系' : '宝石系' }} · 原型「{{ def.prototype }}」
          </div>
          <h2 class="name serif">{{ def.name }}</h2>
          <div class="romaji mono">{{ def.romaji }}</div>
          <div class="traits">
            <span v-for="t in def.traits" :key="t" class="chip">{{ t }}</span>
            <span v-if="st.threeD" class="chip cyan">已 3D 化</span>
          </div>

          <p class="bio">{{ def.bio }}</p>
          <p class="voice serif">「{{ def.voice }}」</p>

          <div class="stats">
            <div v-for="k in STATS" :key="k" class="s-row">
              <span class="s-k">{{ STAT_LABELS[k] }}</span>
              <div class="bar"><i :style="{ width: st.stats[k] + '%', background: def.color }" /></div>
              <span class="s-v mono">{{ Math.round(st.stats[k]) }}</span>
              <span class="s-e mono" :title="'当前发挥水平'">{{ eff[k].toFixed(0) }}</span>
            </div>
            <div class="s-note mono">右列为当前发挥（受心态 / 疲劳影响）</div>
          </div>

          <div class="vitals">
            <div class="vit">
              <span class="v-k">粉丝</span>
              <b class="mono">{{ fmtNum(st.fans) }}</b>
            </div>
            <div class="vit">
              <span class="v-k">心态</span>
              <b class="mono" :class="{ bad: st.morale < 22 }">{{ Math.round(st.morale) }}</b>
              <div class="bar sm"><i :style="{ width: Math.max(0, st.morale) + '%', background: st.morale < 22 ? 'var(--red)' : 'var(--green)' }" /></div>
            </div>
            <div class="vit">
              <span class="v-k">疲劳</span>
              <b class="mono" :class="{ bad: st.fatigue > 82 }">{{ Math.round(st.fatigue) }}</b>
              <div class="bar sm"><i :style="{ width: Math.min(100, st.fatigue) + '%', background: st.fatigue > 82 ? 'var(--red)' : 'var(--violet)' }" /></div>
            </div>
            <div class="vit">
              <span class="v-k">累计贡献</span>
              <b class="mono">{{ fmtNum(st.contributed) }}</b>
            </div>
          </div>

          <div class="pay">
            <div class="pay-row">
              <span class="pay-k">本月到手</span>
              <b class="mono gold">¥{{ fmtNum(takeHome.total) }}</b>
            </div>
            <div class="pay-detail mono">
              底薪 ¥{{ fmtNum(takeHome.base) }} + 流水分成 ¥{{ fmtNum(takeHome.share) }}
              <span class="pay-cut">（公会抽 {{ Math.round(game.gs.resources.guildCut * 100) }}%）</span>
            </div>
          </div>

          <div v-if="st.gradRisk >= 0" class="risk">
            <span class="risk-dot" />
            她正在考虑毕业。剩 {{ st.gradRisk }} 个月。在她崩掉之前把心态拉回 20 以上。
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.card {
  position: relative;
  width: min(880px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 26px;
  padding: 26px;
  background: var(--sheet-2);
  animation: pop-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.x {
  position: absolute;
  top: 14px;
  right: 16px;
  color: var(--dimmer);
  font-size: 15px;
  z-index: 2;
}
.x:hover {
  color: var(--text);
}

.left {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.portrait-wrap {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--c) 18%, transparent), transparent 70%);
}

.glow {
  position: absolute;
  inset: auto 0 0 0;
  height: 60px;
  background: linear-gradient(180deg, transparent, rgba(8, 6, 14, 0.9));
  pointer-events: none;
}

.rank {
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--idol-tone);
}

.right {
  min-width: 0;
  padding-right: 4px;
}

.line-badge {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--dimmer);
}

.name {
  font-size: 30px;
  letter-spacing: 0.1em;
  margin-top: 4px;
  color: var(--idol-tone);
}

.romaji {
  font-size: 11px;
  letter-spacing: 0.24em;
  color: var(--dimmer);
  text-transform: uppercase;
  margin-bottom: 10px;
}

.traits {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 12px;
}

.chip.cyan {
  color: var(--cyan);
  border-color: rgba(111, 227, 255, 0.35);
}

.bio {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.85;
  color: var(--text-2);
}

.voice {
  margin: 0 0 18px;
  font-size: 14px;
  font-style: italic;
  color: var(--warm);
  opacity: 0.9;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 6px;
}

.s-row {
  display: grid;
  grid-template-columns: 34px 1fr 30px 30px;
  align-items: center;
  gap: 9px;
}

.s-k {
  font-size: 11px;
  color: var(--dim);
}

.s-row .bar {
  height: 5px;
}

.s-v {
  font-size: 12px;
  text-align: right;
}

.s-e {
  font-size: 11px;
  text-align: right;
  color: var(--dimmer);
}

.s-note {
  font-size: 9px;
  color: var(--dimmer);
  text-align: right;
  margin-bottom: 14px;
}

.vitals {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 12px 0 4px;
  border-top: 1px solid var(--line);
}

.vit {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.v-k {
  font-size: 9.5px;
  letter-spacing: 0.12em;
  color: var(--dimmer);
}

.vit b {
  font-size: 16px;
}

.vit b.bad {
  color: var(--red);
}

.bar.sm {
  height: 3px;
  margin-top: 2px;
}

.pay {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 9px;
  background: var(--gold-bg);
  border: 1px solid rgba(255, 207, 107, 0.18);
}

.pay-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.pay-k {
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: var(--dimmer);
}

.pay-row b {
  font-size: 17px;
}

.pay-detail {
  margin-top: 2px;
  font-size: 9.5px;
  color: var(--dimmer);
}

.pay-cut {
  opacity: 0.75;
}

.risk {
  margin-top: 14px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 9px;
  background: var(--danger-bg);
  border: 1px solid rgba(255, 90, 110, 0.28);
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--red-soft);
}

.risk-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--red);
  margin-top: 6px;
  flex: 0 0 auto;
  animation: breathe 1s infinite;
}

.detail-enter-active,
.detail-leave-active {
  transition: opacity 0.22s ease;
}
.detail-enter-from,
.detail-leave-to {
  opacity: 0;
}

@media (max-width: 780px) {
  .card {
    grid-template-columns: 1fr;
    padding: 18px;
  }
  .left {
    flex-direction: row;
    align-items: flex-end;
  }
  .portrait-wrap {
    width: 150px;
  }
  .name {
    font-size: 24px;
  }
}
</style>

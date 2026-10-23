<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { IDOL_BY_ID } from '../data/idols'
import { fmtNum } from '../engine/balance'
import IdolIcon from './IdolIcon.vue'

const emit = defineEmits<{ select: [id: string] }>()
const game = useGameStore()

const rows = computed(() =>
  game.gs.idols.map((st) => {
    const def = IDOL_BY_ID.get(st.id)!
    return {
      st,
      def,
      moraleTone: st.morale < 20 ? 'bad' : st.morale < 40 ? 'warn' : 'ok',
      fatigueTone: st.fatigue > 80 ? 'bad' : st.fatigue > 55 ? 'warn' : 'ok',
    }
  }),
)
</script>

<template>
  <aside class="roster">
    <div class="head">
      <span class="section-title">企划成员</span>
      <span class="mono count">{{ game.gs.idols.length }}/8</span>
    </div>

    <div class="list">
      <button
        v-for="r in rows"
        :key="r.st.id"
        class="card"
        :style="{ '--c': r.def.color }"
        @click="emit('select', r.st.id)"
      >
        <IdolIcon :id="r.st.id" :size="42" />
        <div class="info">
          <div class="line1">
            <span class="name">{{ r.def.nick }}</span>
            <span v-if="r.st.threeD" class="badge3d mono">3D</span>
            <span v-if="r.st.gradRisk >= 0" class="badgegrad mono animate-pulse">!</span>
          </div>
          <div class="line2 mono">
            {{ r.def.name }}
            <span class="fans">{{ fmtNum(r.st.fans) }}</span>
          </div>
          <div class="gauges">
            <div class="g">
              <span class="gk">心</span>
              <div class="bar"><i :class="r.moraleTone" :style="{ width: Math.max(0, Math.min(100, r.st.morale)) + '%' }" /></div>
            </div>
            <div class="g">
              <span class="gk">疲</span>
              <div class="bar"><i class="fatigue" :style="{ width: Math.min(100, r.st.fatigue) + '%' }" /></div>
            </div>
          </div>
        </div>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.roster {
  width: 250px;
  flex: 0 0 250px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
  background: linear-gradient(180deg, var(--wash-1), transparent 55%);
  min-height: 0;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
}

.count {
  font-size: 10px;
  color: var(--dimmer);
}

.list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 9px;
  border-radius: 11px;
  border: 1px solid transparent;
  text-align: left;
  transition: all 0.18s ease;
  position: relative;
  overflow: hidden;
}

.card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 12%;
  bottom: 12%;
  width: 2px;
  border-radius: 2px;
  background: var(--c);
  opacity: 0.55;
}

.card:hover {
  background: var(--wash-3);
  border-color: var(--line);
  transform: translateX(2px);
}

.info {
  flex: 1 1 auto;
  min-width: 0;
}

.line1 {
  display: flex;
  align-items: center;
  gap: 5px;
}

.name {
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--idol-tone);
}

.badge3d {
  font-size: 8px;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(111, 227, 255, 0.16);
  color: var(--cyan);
  letter-spacing: 0.1em;
}

.badgegrad {
  font-size: 10px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--red);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  margin-left: auto;
}

.animate-pulse {
  animation: breathe 1s ease-in-out infinite;
}

.line2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 9.5px;
  color: var(--dimmer);
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
}

.fans {
  color: var(--dim);
  font-size: 9.5px;
}

.gauges {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.g {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
}

.gk {
  font-size: 8px;
  color: var(--dimmer);
}

.g .bar {
  flex: 1;
  height: 3px;
}

.g .bar i.ok {
  background: linear-gradient(90deg, var(--green), var(--cyan));
}
.g .bar i.warn {
  background: linear-gradient(90deg, var(--gold), var(--amber));
}
.g .bar i.bad {
  background: linear-gradient(90deg, var(--red), var(--pink));
}
.g .bar i.fatigue {
  background: linear-gradient(90deg, var(--text-4), var(--violet));
}

@media (max-width: 1100px) {
  .roster {
    width: 210px;
    flex-basis: 210px;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { fmtMoney, fmtNum } from '../engine/balance'

const game = useGameStore()

const moneyTone = computed(() => {
  const m = game.gs.resources.money
  if (m < 0) return 'bad'
  if (m < game.fixedCost) return 'warn'
  return 'ok'
})

const fanDelta = computed(() => {
  const h = game.gs.history
  if (h.length < 2) return 0
  return h[h.length - 1].fans - h[h.length - 2].fans
})

const monthProgress = computed(() => {
  if (game.gs.endless) return (game.gs.endlessMonth % 12) / 12
  return (game.gs.monthInPhase - 1) / 12
})
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="logo">鼠</div>
      <div class="brand-text">
        <div class="brand-name">鼠标的偶像梦</div>
        <div class="brand-sub mono">
          {{ game.gs.endless ? 'ENDLESS' : `PHASE ${game.gs.phase}` }} ·
          {{ game.gs.endless ? '无限流' : game.seasonLabel }}
        </div>
      </div>
    </div>

    <div class="stats">
      <div class="stat" :class="moneyTone">
        <span class="k">资金</span>
        <span class="v mono">¥{{ fmtMoney(game.gs.resources.money) }}</span>
      </div>
      <div class="stat">
        <span class="k">总粉丝</span>
        <span class="v mono">{{ fmtNum(game.totalFans) }}</span>
        <span v-if="fanDelta" class="delta mono" :class="fanDelta > 0 ? 'up' : 'down'">
          {{ fanDelta > 0 ? '▲' : '▼' }}{{ fmtNum(Math.abs(fanDelta)) }}
        </span>
      </div>
      <div class="stat">
        <span class="k">口碑</span>
        <span class="v mono">{{ game.gs.resources.reputation.toFixed(1) }}</span>
      </div>
      <div class="stat">
        <span class="k">固定支出</span>
        <span class="v mono dim">-¥{{ fmtMoney(game.fixedCost) }}/月</span>
      </div>
    </div>

    <div class="ap">
      <div class="ap-head">
        <span class="k">行动点</span>
        <span class="v mono">{{ game.remainAp }} / {{ game.gs.resources.apMax }}</span>
      </div>
      <div class="ap-pips">
        <i
          v-for="n in game.gs.resources.apMax"
          :key="n"
          :class="{ on: n <= game.remainAp }"
        />
      </div>
    </div>

    <div class="progress">
      <div class="bar">
        <i
          :style="{
            width: monthProgress * 100 + '%',
            background:
              game.gs.phase === 2
                ? 'linear-gradient(90deg,var(--gold),var(--pink))'
                : 'linear-gradient(90deg,var(--violet),var(--cyan))',
          }"
        />
      </div>
      <span class="mono prog-label">
        {{ game.gs.endless ? '∞' : `${game.gs.monthInPhase} / 12` }}
      </span>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 26px;
  padding: 12px 22px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, var(--wash-2), transparent);
  flex: 0 0 auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 190px;
}

.logo {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-family: var(--serif);
  font-size: 19px;
  color: var(--btn-text-on-accent);
  background: var(--accent-grad);
  box-shadow: 0 4px 16px rgba(255, 150, 200, 0.3);
}

.brand-name {
  font-family: var(--serif);
  font-size: 15px;
  letter-spacing: 0.08em;
}

.brand-sub {
  font-size: 10px;
  color: var(--dimmer);
  letter-spacing: 0.14em;
}

.stats {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 74px;
}

.stat .k {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--dimmer);
}

.stat .v {
  font-size: 15px;
  font-weight: 600;
}

.stat.ok .v {
  color: var(--text);
}
.stat.warn .v {
  color: var(--gold);
}
.stat.bad .v {
  color: var(--red);
  animation: breathe 1.2s ease-in-out infinite;
}

.delta {
  font-size: 10px;
  margin-top: -2px;
}
.delta.up {
  color: var(--green);
}
.delta.down {
  color: var(--red);
}

.ap {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ap-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.ap-head .k {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--dimmer);
}
.ap-head .v {
  font-size: 13px;
  font-weight: 600;
}

.ap-pips {
  display: flex;
  gap: 4px;
}
.ap-pips i {
  width: 18px;
  height: 4px;
  border-radius: 2px;
  background: var(--track);
  transition: all 0.3s ease;
}
.ap-pips i.on {
  background: linear-gradient(90deg, var(--gold), var(--pink));
  box-shadow: 0 0 10px var(--accent-glow);
}

.progress {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}
.progress .bar {
  width: 84px;
}
.prog-label {
  font-size: 10px;
  color: var(--dimmer);
}

@media (max-width: 1100px) {
  .topbar {
    gap: 14px;
    padding: 10px 14px;
    flex-wrap: wrap;
  }
  .brand {
    min-width: 0;
  }
  .stats {
    gap: 14px;
  }
  .stat {
    min-width: 60px;
  }
  .stat .v {
    font-size: 13px;
  }
  .progress {
    display: none;
  }
}
</style>

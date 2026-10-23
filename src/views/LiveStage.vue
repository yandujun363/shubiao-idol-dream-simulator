<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { backdrop } from '../render/pixi/backdrop'
import { IDOLS } from '../data/idols'
import { fmtNum } from '../engine/balance'
import { audio } from '../audio/engine'

const game = useGameStore()
const step = ref<0 | 1 | 2>(0)
const lineIdx = ref(0)
const showBreakdown = ref(false)

let timers: number[] = []

const grade = computed(() => game.liveGrade!)

const colors = IDOLS.map((d) => d.color)

const TIMELINE = [
  '倒计时归零。虚拟场馆的灯从四个角依次亮起。',
  '第一首歌，《未完成的企划书》。',
  '弹幕里有人跟着唱了。滚得很快，但是很大。',
  '第二首歌的时候，耳返出了一点问题。她们撑住了。',
  '你坐在导播台后面。运营在你旁边，一直没说话。',
  '中场。八个人在后台挤成一团，谁也没有补妆。',
  '最后一首歌。直播间的灯牌开始一片一片地亮起来。',
]

function start() {
  step.value = 1
  audio.sfx('applause')
  backdrop.setStageConfig({ intensity: 1 })
  tick()
}

function tick() {
  if (step.value !== 1) return
  if (lineIdx.value >= TIMELINE.length) {
    reveal()
    return
  }
  lineIdx.value += 1
  if (lineIdx.value > 0 && lineIdx.value % 2 === 0) backdrop.burst(18)
  const t = window.setTimeout(tick, 1250)
  timers.push(t)
}

function reveal() {
  timers.forEach((t) => clearTimeout(t))
  timers = []
  step.value = 2
  audio.sfx('chime')
  backdrop.setStageConfig({ intensity: 0.45 })
  backdrop.burst(90)
  window.setTimeout(() => (showBreakdown.value = true), 260)
}

function skip() {
  timers.forEach((t) => clearTimeout(t))
  timers = []
  lineIdx.value = TIMELINE.length
  reveal()
}

function curtain() {
  audio.sfx('confirm')
  backdrop.hideStage()
  game.concludeLive()
}

onMounted(() => {
  backdrop.showStage({
    fans: game.totalFans,
    colors,
    threeD: game.gs.idols.filter((i) => i.threeD).length,
    intensity: 0.22,
  })
})

onBeforeUnmount(() => {
  timers.forEach((t) => clearTimeout(t))
  timers = []
  backdrop.hideStage()
})

const attendance = computed(() => grade.value.attendance)
</script>

<template>
  <div class="live" :class="{ 'no-pixi': backdrop.failed.value }">
    <div class="vignette" />
    <div class="live-badge mono"><i />LIVE · 线上直播中</div>

    <!-- 入场 -->
    <Transition name="fade">
      <div v-if="step === 0" class="intro">
        <div class="kicker mono">FINAL STAGE · 线上演唱会 LIVE</div>
        <h1 class="live-title serif">
          灯牌<br /><span>铺满</span>
        </h1>
        <p class="live-sub serif">
          24 个月。<br />
          账上的数字、数据表上的曲线、还有八个人的心跳。<br />
          今天，全部要在同一个直播间里摊开。
        </p>
        <button class="btn btn-primary big" @click="start">开播</button>
      </div>
    </Transition>

    <!-- 演出中 -->
    <Transition name="fade">
      <div v-if="step === 1 && lineIdx > 0" class="perform">
        <div class="p-line serif">{{ TIMELINE[Math.min(lineIdx - 1, TIMELINE.length - 1)] }}</div>
        <button class="skip mono" @click="skip">跳过 ▸▸</button>
      </div>
    </Transition>

    <!-- 结果 -->
    <Transition name="fade">
      <div v-if="step === 2" class="result">
        <div class="result-card">
        <div class="res-head">
          <div class="kicker mono">LIVE RESULT</div>
          <div class="score mono">
            <span class="score-num">{{ grade.score.toFixed(1) }}</span>
            <span class="score-max">/ 100</span>
          </div>
          <h2 class="tier serif" :class="grade.tier">{{ grade.tierLabel }}</h2>
          <div class="res-meta mono">
            峰值在线 {{ fmtNum(attendance) }} 人 · 3D {{ grade.threeDCount }} / 8
          </div>
        </div>

        <div class="breakdown" :class="{ show: showBreakdown }">
          <div v-for="b in grade.breakdown" :key="b.label" class="b-row">
            <span class="b-label">{{ b.label }}</span>
            <div class="bar">
              <i
                :style="{
                  width: `${Math.max(0, Math.min(100, (Math.abs(b.value) / (b.label === '疲劳扣分' ? 10 : 40)) * 100))}%`,
                  background: b.value < 0 ? '#ff6b81' : 'linear-gradient(90deg,#ffcf6b,#ff86c8)',
                }"
              />
            </div>
            <span class="b-val mono" :class="{ neg: b.value < 0, zero: Math.abs(b.value) < 0.05 }">
              {{ Math.abs(b.value) < 0.05 ? '0.0' : (b.value > 0 ? '+' : '') + b.value.toFixed(1) }}
            </span>
          </div>
        </div>

        <button class="btn btn-primary big curtain" @click="curtain">下播</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.live {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

.live.no-pixi {
  background:
    radial-gradient(900px 600px at 50% 30%, #1a0f2c, transparent 70%),
    linear-gradient(180deg, #06040c, #120a20 55%, #06040c);
}

.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 90% at 50% 40%, transparent 40%, rgba(2, 1, 6, 0.72) 100%),
    linear-gradient(180deg, rgba(2, 1, 6, 0.6), transparent 22%, transparent 72%, rgba(2, 1, 6, 0.85));
}

.live-badge {
  position: absolute;
  top: 18px;
  left: 20px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 9px;
  letter-spacing: 0.2em;
  color: #f2ecff;
  background: rgba(10, 6, 20, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(6px);
}

.live-badge i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff5c7a;
  box-shadow: 0 0 10px #ff5c7a;
  animation: live-pulse 1.4s ease-in-out infinite;
}

@keyframes live-pulse {
  50% {
    opacity: 0.35;
  }
}

.intro {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px 24px 26vh;
  background: radial-gradient(closest-side at 50% 40%, rgba(5, 3, 12, 0.72), transparent 80%);
  animation: fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.kicker {
  font-size: 9px;
  letter-spacing: 0.42em;
  color: #7d739b;
  margin-bottom: 18px;
}

.live-title {
  font-size: clamp(46px, 10vw, 108px);
  line-height: 1.02;
  letter-spacing: 0.1em;
  margin: 0;
  color: #f4efff;
  text-shadow: 0 0 90px rgba(180, 150, 255, 0.4);
}

.live-title span {
  background: linear-gradient(100deg, #ffcf6b, #ff86c8 60%, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 50px rgba(255, 140, 200, 0.45));
}

.live-sub {
  margin: 26px 0 34px;
  font-size: 14px;
  line-height: 2.15;
  color: var(--text-3);
}

.btn.big {
  padding: 13px 46px;
  font-size: 15px;
  letter-spacing: 0.34em;
  border-radius: 999px;
}

.perform {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 56px;
  padding: 0 8vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.p-line {
  font-size: clamp(14px, 1.7vw, 18px);
  line-height: 2;
  color: #efe9ff;
  text-shadow: 0 2px 30px rgba(0, 0, 0, 0.9), 0 0 40px rgba(120, 90, 200, 0.4);
  animation: fade-up 0.8s ease both;
  max-width: 760px;
}

.skip {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: #6d6488;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
}
.skip:hover {
  color: var(--text);
}

.result {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 4vh 28px 28px;
  overflow-y: auto;
  background: radial-gradient(closest-side at 50% 45%, rgba(4, 2, 10, 0.55), transparent 85%);
  animation: fade-in 0.6s ease both;
}

.result-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(560px, 94vw);
  padding: 20px 30px 24px;
  border-radius: 20px;
  background: rgba(8, 5, 16, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(16px);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
}

.res-head {
  text-align: center;
  margin-bottom: 18px;
}

.score {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  margin-top: 4px;
}

.score-num {
  font-size: clamp(52px, 8vw, 84px);
  line-height: 1;
  font-weight: 700;
  background: linear-gradient(100deg, #ffcf6b, #ff86c8);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 40px rgba(255, 160, 200, 0.4));
}

.score-max {
  font-size: 13px;
  color: var(--dimmer);
}

.tier {
  margin-top: 8px;
  font-size: clamp(24px, 3.4vw, 38px);
  letter-spacing: 0.3em;
  color: #f6f0ff;
}
.tier.legend,
.tier.perfect {
  background: linear-gradient(100deg, #ffcf6b, #ff86c8 60%, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 36px rgba(255, 180, 210, 0.45));
}
.tier.poor {
  color: #a9a0c0;
}

.res-meta {
  margin-top: 8px;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: var(--dimmer);
}

.breakdown {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 26px;
  opacity: 0;
  transition: opacity 0.6s ease;
}

.breakdown.show {
  opacity: 1;
}

.b-row {
  display: grid;
  grid-template-columns: 80px 1fr 54px;
  align-items: center;
  gap: 12px;
}

.b-label {
  font-size: 11px;
  color: var(--dim);
}

.b-row .bar {
  height: 5px;
}

.b-val {
  font-size: 11px;
  text-align: right;
  color: var(--gold);
}
.b-val.neg {
  color: var(--red-soft);
}
.b-val.zero {
  color: var(--dimmer);
}

.curtain {
  padding: 11px 40px;
  letter-spacing: 0.24em;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 700px) {
  .breakdown {
    width: 100%;
  }
  .b-row {
    grid-template-columns: 62px 1fr 44px;
    gap: 8px;
  }
  .live-sub {
    font-size: 12.5px;
  }
}
</style>

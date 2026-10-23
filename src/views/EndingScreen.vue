<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGameStore } from '../stores/game'
import { audio } from '../audio/engine'
import { IDOL_BY_ID, IDOLS } from '../data/idols'
import IdolPortrait from '../components/IdolPortrait.vue'

const game = useGameStore()
const ending = computed(() => game.ending!)
const isHe = computed(() => ending.value.type === 'HE')

onMounted(() => {
  window.setTimeout(() => {
    if (isHe.value) audio.sfx('applause')
  }, 500)
})

function restart() {
  audio.sfx('confirm')
  audio.setMood('day')
  game.wipe()
  game.newGame()
}

function endless() {
  audio.sfx('confirm')
  game.startEndless()
}

function toTitle() {
  audio.sfx('click')
  game.backToTitle()
}
</script>

<template>
  <div class="ending" :class="isHe ? 'he' : 'be'">
    <div class="bg" />

    <div class="scroll">
      <header class="head enter-fade">
        <div class="badge mono" :class="isHe ? 'he' : 'be'">
          {{ ending.type }}
        </div>
        <h1 class="title serif">{{ ending.title }}</h1>
        <p class="subtitle serif">{{ ending.subtitle }}</p>
      </header>

      <article class="body">
        <p
          v-for="(para, i) in ending.body"
          :key="i"
          class="para serif"
          :class="{ empty: !para.trim() }"
          :style="{ animationDelay: `${Math.min(i * 55, 1400)}ms` }"
        >
          {{ para }}
        </p>
      </article>

      <section class="epilogue enter-up" :style="{ animationDelay: '1.1s' }">
        <div class="section-title">EPILOGUE · 结算</div>
        <div class="ep-grid">
          <div v-for="(e, i) in ending.epilogue" :key="i" class="ep-item">
            <span class="ep-k">{{ e.label }}</span>
            <span class="ep-v mono">{{ e.value }}</span>
          </div>
        </div>
      </section>

      <section v-if="ending.cast?.length" class="cast-table enter-up" :style="{ animationDelay: '1.25s' }">
        <div class="section-title">MEMBERS · 八个人</div>
        <div class="ct-head">
          <span>成员</span><span>原型</span><span>粉丝</span><span>心态</span><span>3D</span><span>状态</span>
        </div>
        <div v-for="m in ending.cast" :key="m.id" class="ct-row" :style="{ '--c': IDOL_BY_ID.get(m.id)?.color }">
          <span class="ct-name">{{ m.name }}</span>
          <span class="ct-dim">{{ m.prototype }}</span>
          <span class="mono">{{ m.fans }}</span>
          <span class="mono" :class="{ low: Number(m.morale) < 30 }">{{ m.morale }}</span>
          <span class="mono">{{ m.threeD ? '✓' : '—' }}</span>
          <span class="ct-note">{{ m.note }}</span>
        </div>
      </section>

      <section v-if="isHe" class="cast enter-up" :style="{ animationDelay: '1.3s' }">
        <div class="section-title">CAST · 全员</div>
        <div class="cast-row">
          <div v-for="d in IDOLS" :key="d.id" class="cast-item" :style="{ '--c': d.color }">
            <IdolPortrait :id="d.id" :size="150" :bg="0.7" />
            <span class="cast-name serif">{{ d.name }}</span>
          </div>
        </div>
      </section>

      <footer class="actions enter-up" :style="{ animationDelay: '1.5s' }">
        <template v-if="isHe">
          <button class="btn btn-primary" @click="endless">继续 · 无限流</button>
        </template>
        <template v-else>
          <button class="btn btn-primary" @click="restart">再试一次</button>
        </template>
        <button class="btn" @click="toTitle">回到标题</button>
      </footer>

      <p v-if="isHe" class="note mono enter-fade">
        无限流模式没有剧情，只有数据。鼠标说：我想看看这条曲线能到哪。
      </p>
      <p v-else class="note mono enter-fade">
        企划已结束。数据表还在，只是没有人再往里填东西了。
      </p>
    </div>
  </div>
</template>

<style scoped>
.ending {
  position: relative;
  height: 100%;
  overflow-y: auto;
}

.bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  transition: opacity 1.2s ease;
}

.ending.he .bg {
  background: var(--ending-glow-he);
}

.ending.be .bg {
  background: var(--ending-glow-be);
}

.scroll {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: clamp(40px, 9vh, 90px) 28px 90px;
}

.head {
  text-align: center;
  margin-bottom: 44px;
}

.badge {
  display: inline-block;
  padding: 3px 16px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.4em;
  margin-bottom: 20px;
}

.badge.he {
  color: var(--btn-text-on-accent);
  background: var(--accent-grad);
  box-shadow: 0 6px 30px rgba(255, 170, 200, 0.3);
}

.badge.be {
  color: var(--text-3);
  border: 1px solid var(--line-hi);
  background: var(--wash-2);
}

.title {
  font-size: clamp(34px, 6vw, 58px);
  letter-spacing: 0.16em;
  margin: 0;
  line-height: 1.2;
}

.he .title {
  background: linear-gradient(100deg, var(--ink), var(--gold) 42%, var(--pink) 76%, var(--violet));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 50px rgba(255, 190, 210, 0.28));
}

.be .title {
  color: var(--text);
  text-shadow: 0 0 60px rgba(120, 110, 160, 0.3);
}

.subtitle {
  margin: 14px 0 0;
  font-size: 13px;
  letter-spacing: 0.2em;
  color: var(--dimmer);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.para {
  margin: 0 0 18px;
  font-size: 15.5px;
  line-height: 2.15;
  color: var(--text-2);
  white-space: pre-wrap;
  animation: fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.para.empty {
  margin-bottom: 8px;
}

.be .para {
  color: var(--text-3);
}

.epilogue,
.cast {
  margin-top: 46px;
  animation: fade-up 0.7s ease both;
}

.ep-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.ep-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--wash-1);
}

.ep-k {
  font-size: 9.5px;
  letter-spacing: 0.12em;
  color: var(--dimmer);
}

.ep-v {
  font-size: 13px;
  color: var(--text);
}

.cast-table {
  margin-top: 18px;
  animation: fade-up 0.7s ease both;
}

.ct-head,
.ct-row {
  display: grid;
  grid-template-columns: 1.3fr 0.9fr 0.8fr 0.6fr 0.5fr 1.3fr;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  font-size: 11.5px;
}

.ct-head {
  margin-top: 12px;
  border-radius: 9px 9px 0 0;
  background: var(--wash-3);
  font-size: 9px;
  letter-spacing: 0.14em;
  color: var(--dimmer);
}

.ct-row {
  border-bottom: 1px solid var(--wash-3);
  border-left: 2px solid transparent;
}

.ct-row:nth-child(even) {
  background: var(--wash-1);
}

.ct-name {
  color: var(--idol-tone);
}

.ct-dim {
  color: var(--dimmer);
  font-size: 10.5px;
}

.ct-note {
  font-size: 10.5px;
  color: var(--dim);
}

.mono.low {
  color: var(--red);
}

.cast-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 14px;
}

.cast-item {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--c) 16%, transparent), transparent 70%);
}

.cast-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 6px;
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--idol-tone);
  text-shadow: 0 1px 8px #000;
}

.actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 46px;
  flex-wrap: wrap;
  animation: fade-up 0.7s ease both;
}

.note {
  margin-top: 26px;
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-4);
  line-height: 1.9;
}

@media (max-width: 640px) {
  .cast-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .para {
    font-size: 14px;
    line-height: 2;
  }
}
</style>

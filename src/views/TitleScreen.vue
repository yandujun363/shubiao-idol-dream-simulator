<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { IDOLS } from '../data/idols'
import { fmtNum, monthlyFixedCost } from '../engine/balance'
import IdolPortrait from '../components/IdolPortrait.vue'
import { audio } from '../audio/engine'

const game = useGameStore()
const hasSave = ref(false)
const showAbout = ref(false)
const showNotice = ref(false)

const NOTICE_KEY = 'mouse-idol-notice-v1'

const startFans = computed(() => IDOLS.reduce((s, d) => s + d.fans, 0))
const fixedCost = monthlyFixedCost(1)

onMounted(() => {
  hasSave.value = game.hasSave()
  // 声明只在第一次进站时挡一次，之后从页脚「声明」随时再看
  try {
    showNotice.value = !localStorage.getItem(NOTICE_KEY)
  } catch {
    showNotice.value = true
  }
})

function dismissNotice() {
  audio.sfx('confirm')
  showNotice.value = false
  try {
    localStorage.setItem(NOTICE_KEY, '1')
  } catch {
    /* 无痕模式写不进去，下次再弹一次也无所谓 */
  }
}

function startNew() {
  audio.sfx('confirm')
  game.wipe()
  game.newGame()
}

function continueGame() {
  audio.sfx('confirm')
  if (!game.load()) game.newGame()
}

// 八个成员排成一道弧
function arcStyle(i: number) {
  const t = i / (IDOLS.length - 1)
  const angle = (t - 0.5) * 26
  const lift = Math.cos((t - 0.5) * Math.PI) * 26
  return {
    transform: `rotate(${angle}deg) translateY(${-lift}px)`,
    transformOrigin: 'bottom center',
    zIndex: 10 - Math.abs(Math.round((t - 0.5) * 10)),
  }
}

// 「中文前缀 + 英文后缀」在窄屏上要拆两行，否则八个名字会挤成一团
function nameParts(full: string) {
  const m = full.match(/^([\u3400-\u9fff]+)(.*)$/)
  return m ? { cn: m[1], en: m[2] } : { cn: full, en: '' }
}
</script>

<template>
  <div class="title">
    <div class="scanlines" />

    <header class="hero">
      <div class="kicker mono">A TEXT-ONLY IDOL SIMULATOR · 2026</div>
      <h1 class="maintitle serif">
        <span class="l1">鼠标的</span>
        <span class="l2">偶像梦</span>
        <span class="l3">模拟器</span>
      </h1>
      <p class="sub serif">
        25 万启动资金 · 8 个不火的虚拟主播 · 24 个月。<br />
        要么让灯牌铺满，要么让账本归零。
      </p>

      <div class="facts mono">
        <span>起始资金 <b>¥250,000</b></span>
        <span class="sep">·</span>
        <span>成员 <b>8</b></span>
        <span class="sep">·</span>
        <span>初始粉丝 <b>{{ fmtNum(startFans) }}</b></span>
        <span class="sep">·</span>
        <span>月固定支出 <b>¥{{ fixedCost.toLocaleString() }}</b></span>
      </div>

      <div class="actions">
        <button class="btn btn-primary big" @click="startNew">开始新企划</button>
        <button v-if="hasSave" class="btn big" @click="continueGame">继续上一次</button>
        <button class="btn btn-ghost big" @click="showAbout = !showAbout">这个企划是什么</button>
      </div>
    </header>

    <div class="stage-row">
      <div
        v-for="(d, i) in IDOLS"
        :key="d.id"
        class="idol-slot"
        :style="{ ...arcStyle(i), '--c': d.color }"
      >
        <div class="halo" />
        <IdolPortrait :id="d.id" :size="190" :bg="0.85" />
        <div class="slot-label">
          <span class="slot-name serif"
            ><span class="cn">{{ nameParts(d.name).cn }}</span
            ><span class="en">{{ nameParts(d.name).en }}</span></span
          >
          <span class="slot-sub mono">{{ d.romaji }}</span>
        </div>
      </div>
    </div>

    <footer class="foot mono">
      <span class="foot-left">
        <span class="hint">点击任意处启用声音 · 全部素材由 JS 实时合成</span>
        <button class="notice-link" @click="showNotice = true">声明</button>
      </span>
      <span class="ver">v1.0</span>
    </footer>

    <Transition name="about">
      <div v-if="showAbout" class="about-overlay" @click.self="showAbout = false">
        <div class="about panel">
          <div class="section-title">ABOUT · 关于这个企划</div>
          <h2 class="about-title serif">鼠标的偶像梦</h2>
          <p>
            鼠标是一个开公会的老板。他从初中就有一个偶像梦：站到舞台上，屏幕上全是刷过去的灯牌。
          </p>
          <p>
            他读的是医疗器械，做事讲究数据，习惯把一切换算成表格里的格子。他签主播、做企划、写复盘报告，
            一遍一遍地迭代。结果是：推一个糊一个，搞企划没人看，他自己偶尔上阵套个皮，弹幕刷的是「老板别唱了」。
          </p>
          <p>
            但奇怪的是，公司一直没倒。账算得清楚，不乱花钱，不瞎扩张。只是那个梦，始终没实现。
          </p>
          <p class="hl">
            现在，你是这个企划的新负责人。<br />
            前任受不了 V 圈的压力，留下 25 万资金就走了。<br />
            企划里有 8 个人，分成光芒系和宝石系，每人一个独立的账号。
          </p>
          <p>
            你要做的事很简单：让她们活下去，让她们被看见，然后在第 24 个月，让八个人一起开一场线上演唱会。
          </p>
          <p class="warnline">
            但记住：任何一个人毕业，这个企划就结束了。钱没了也一样。
          </p>
          <button class="btn close-about" @click="showAbout = false">知道了</button>
        </div>
      </div>
    </Transition>

    <!-- 开始前的声明：挡住第一次进站，点过之后从页脚再进来 -->
    <Transition name="about">
      <div v-if="showNotice" class="about-overlay">
        <div class="about panel notice">
          <div class="section-title">NOTICE · 声明</div>
          <h2 class="about-title serif">开始之前</h2>
          <p>
            此游戏纯属 agent 产物，为站长闲着没事干玩梗搞的，游戏内的设定全部是脚填的，数值也是脚填的。
          </p>
          <p class="warnline">
            不要去打扰人家主播，也不要去跳脸主播和标哥。
          </p>
          <button class="btn btn-primary close-about" @click="dismissNotice">我已知晓</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.title {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scanlines {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    0deg,
    var(--scanline) 0px,
    var(--scanline) 1px,
    transparent 1px,
    transparent 3px
  );
  pointer-events: none;
  mix-blend-mode: overlay;
}

.hero {
  position: relative;
  z-index: 2;
  padding: clamp(22px, 4.5vh, 56px) 32px 0;
  text-align: center;
  flex: 0 0 auto;
}

.kicker {
  font-size: 9px;
  letter-spacing: 0.42em;
  color: var(--dimmer);
  margin-bottom: 14px;
}

.maintitle {
  font-size: clamp(38px, 7vw, 76px);
  line-height: 1.02;
  letter-spacing: 0.06em;
  font-weight: 700;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.maintitle .l1 {
  color: var(--ink);
  text-shadow: var(--title-shadow);
}
.maintitle .l2 {
  background: linear-gradient(100deg, var(--gold) 8%, var(--pink) 55%, var(--violet) 94%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 40px rgba(255, 140, 200, 0.35));
}
.maintitle .l3 {
  font-size: 0.44em;
  letter-spacing: 0.5em;
  color: var(--text-4);
  margin-top: 6px;
  font-weight: 400;
}

.sub {
  margin: 22px auto 0;
  max-width: 560px;
  font-size: 14px;
  line-height: 2.1;
  color: var(--text-3);
}

.facts {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
  font-size: 10.5px;
  color: var(--dimmer);
  letter-spacing: 0.05em;
}
.facts b {
  color: var(--gold);
  font-weight: 600;
}
.facts .sep {
  opacity: 0.4;
}

.actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 26px;
}

.btn.big {
  padding: 12px 30px;
  font-size: 14px;
  letter-spacing: 0.08em;
  border-radius: 12px;
  line-height: 1.4;
}

.stage-row {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: clamp(-8px, -0.4vw, 0px);
  padding: 0 clamp(8px, 2.5vw, 48px) 14px;
  min-height: 0;
  overflow: hidden;
}

.idol-slot {
  position: relative;
  width: clamp(76px, 10vw, 178px);
  height: auto;
  overflow: hidden;
  border-radius: 12px;
  margin: 0 clamp(-14px, -0.7vw, -3px);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), filter 0.4s ease;
  filter: var(--idol-filter-soft);
}

.idol-slot:hover {
  filter: saturate(1.15) brightness(1.1);
  transform: translateY(-14px) scale(1.05) !important;
  z-index: 20 !important;
}

.halo {
  position: absolute;
  left: 50%;
  bottom: 8%;
  width: 90%;
  height: 60%;
  transform: translateX(-50%);
  background: radial-gradient(closest-side, color-mix(in srgb, var(--c) 28%, transparent), transparent 72%);
  filter: blur(14px);
  pointer-events: none;
}

.idol-slot :deep(canvas) {
  position: relative;
  z-index: 1;
  width: 100% !important;
  height: auto !important;
  display: block;
}

.slot-label {
  position: static;
  margin-top: 6px;
  padding: 0 2px;
  text-align: center;
  opacity: 1;
  transition: all 0.3s ease;
  pointer-events: none;
}

.idol-slot:hover .slot-label {
  opacity: 1;
  transform: translateY(-3px);
}

.slot-name {
  display: block;
  font-size: clamp(9px, 1vw, 12px);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--idol-tone);
  text-shadow: var(--idol-shadow);
}

.slot-sub {
  display: block;
  font-size: 7px;
  letter-spacing: 0.16em;
  color: var(--text-3);
  text-transform: uppercase;
}

.foot {
  position: relative;
  z-index: 5;
  background: linear-gradient(180deg, transparent, var(--bg) 45%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 26px;
  font-size: 9px;
  letter-spacing: 0.14em;
  color: var(--text-4);
  border-top: 1px solid var(--wash-3);
  flex: 0 0 auto;
}

.foot-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.notice-link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  letter-spacing: inherit;
  color: var(--text-4);
  cursor: pointer;
  transition: color 0.2s ease;
}

.notice-link:hover {
  color: var(--gold);
}

.about-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(4, 3, 10, 0.8);
  backdrop-filter: blur(8px);
}

.about {
  width: min(620px, 100%);
  max-height: 82vh;
  overflow-y: auto;
  padding: 26px 30px;
  background: var(--sheet);
  animation: pop-in 0.28s ease both;
}

.about-title {
  font-size: 24px;
  margin: 10px 0 16px;
  letter-spacing: 0.08em;
  background: linear-gradient(100deg, var(--gold), var(--pink));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.about p {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.95;
  color: var(--text-2);
}

.about p.hl {
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--gold-bg);
  border-left: 2px solid var(--gold-line);
  color: var(--warm);
}

.about p.warnline {
  color: var(--red-soft);
  font-size: 12.5px;
}

.close-about {
  margin-top: 8px;
  width: 100%;
}

.notice {
  width: min(520px, 100%);
}

.notice p {
  font-size: 13.5px;
  line-height: 2;
}

.notice .close-about {
  margin-top: 18px;
}

.about-enter-active,
.about-leave-active {
  transition: opacity 0.22s ease;
}
.about-enter-from,
.about-leave-to {
  opacity: 0;
}

@media (max-width: 780px) {
  .hero {
    padding-top: 26px;
  }
  .sub {
    font-size: 12.5px;
  }
  .facts {
    font-size: 9px;
    gap: 6px;
  }
  .stage-row {
    gap: 0;
    padding-left: 20px;
    padding-right: 20px;
    padding-bottom: 72px;
  }
  .idol-slot {
    width: 13.5vw;
    margin: 0 -6px;
    height: auto;
  }
  .slot-label {
    position: static;
    margin-top: 4px;
  }
  .slot-sub {
    display: none;
  }
  .slot-name {
    line-height: 1.15;
  }
  .slot-name .en {
    display: block;
    font-size: 7px;
    letter-spacing: 0.05em;
  }
  .foot .hint {
    display: none;
  }
}
</style>

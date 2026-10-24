<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTheme } from '../stores/theme'
import { useGameStore } from '../stores/game'
import { IDOL_BY_ID } from '../data/idols'
import { STAT_LABELS, type StatKey } from '../engine/types'
import { CONFIG, fmtMoney, fmtNum } from '../engine/balance'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const game = useGameStore()
const { resolved } = useTheme()

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

const fansCanvas = ref<HTMLCanvasElement | null>(null)
const moneyCanvas = ref<HTMLCanvasElement | null>(null)

const STATS: StatKey[] = ['vocal', 'dance', 'talk', 'charm']

const history = computed(() => game.gs.history)

function drawSeries(
  canvas: HTMLCanvasElement,
  values: number[],
  color: string,
  opts: { zero?: boolean; fill?: boolean } = {},
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = canvas.getBoundingClientRect()
  const w = rect.width
  const h = rect.height
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  if (values.length < 2) return

  const padT = 10
  const padB = 8
  const padL = 2
  const padR = 2
  const plotW = w - padL - padR
  const plotH = h - padT - padB

  let min = Math.min(...values)
  let max = Math.max(...values)
  if (opts.zero) max = Math.max(max, 0)
  if (max === min) {
    max += Math.abs(max) * 0.1 + 1
    min -= Math.abs(min) * 0.1 + 1
  }
  const range = max - min

  const xOf = (i: number) => padL + (i / (values.length - 1)) * plotW
  const yOf = (v: number) => padT + (1 - (v - min) / range) * plotH

  // 网格
  ctx.strokeStyle = cssVar('--line-soft', 'rgba(255,255,255,0.06)')
  ctx.lineWidth = 1
  for (let i = 0; i <= 3; i++) {
    const y = padT + (i / 3) * plotH
    ctx.beginPath()
    ctx.moveTo(padL, y)
    ctx.lineTo(w - padR, y)
    ctx.stroke()
  }

  // 零线
  if (opts.zero && min < 0 && max > 0) {
    const y0 = yOf(0)
    ctx.strokeStyle = 'rgba(255,120,120,0.35)'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(padL, y0)
    ctx.lineTo(w - padR, y0)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // 面积
  if (opts.fill) {
    const g = ctx.createLinearGradient(0, padT, 0, padT + plotH)
    g.addColorStop(0, color + '55')
    g.addColorStop(1, color + '00')
    ctx.beginPath()
    ctx.moveTo(xOf(0), padT + plotH)
    values.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)))
    ctx.lineTo(xOf(values.length - 1), padT + plotH)
    ctx.closePath()
    ctx.fillStyle = g
    ctx.fill()
  }

  // 线
  ctx.beginPath()
  values.forEach((v, i) => {
    const x = xOf(i)
    const y = yOf(v)
    if (i === 0) ctx.moveTo(x, y)
    else {
      const px = xOf(i - 1)
      const py = yOf(values[i - 1])
      const cx = (px + x) / 2
      ctx.bezierCurveTo(cx, py, cx, y, x, y)
    }
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.shadowColor = color
  ctx.shadowBlur = 8
  ctx.stroke()
  ctx.shadowBlur = 0

  // 末点
  const lx = xOf(values.length - 1)
  const ly = yOf(values[values.length - 1])
  ctx.beginPath()
  ctx.arc(lx, ly, 3.2, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.beginPath()
  ctx.arc(lx, ly, 6.5, 0, Math.PI * 2)
  ctx.strokeStyle = color + '66'
  ctx.lineWidth = 1
  ctx.stroke()
}

function redraw() {
  if (fansCanvas.value)
    drawSeries(fansCanvas.value, history.value.map((h) => h.fans), cssVar('--gold', '#ffcf6b'), { fill: true })
  if (moneyCanvas.value)
    drawSeries(moneyCanvas.value, history.value.map((h) => h.money), cssVar('--violet', '#a78bfa'), { zero: true })
}

onMounted(redraw)
watch(() => [props.open, history.value.length, resolved.value], () => setTimeout(redraw, 40), { immediate: true })

const totalStats = computed(() => {
  const sum = Object.fromEntries(STATS.map((k) => [k, 0])) as Record<StatKey, number>
  game.gs.idols.forEach((i) => STATS.forEach((k) => (sum[k] += i.stats[k])))
  return sum
})

const r2 = computed(() => {
  // 伪 R²：只是为了让鼠标的数据表看起来更专业
  const h = history.value
  if (h.length < 3) return 0.3
  const xs = h.map((p) => p.month)
  const ys = h.map((p) => p.fans)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx
  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < n; i++) {
    const pred = slope * xs[i] + intercept
    ssRes += (ys[i] - pred) ** 2
    ssTot += (ys[i] - my) ** 2
  }
  return ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot)
})
</script>

<template>
  <Transition name="data">
    <div v-if="open" class="overlay" @click.self="emit('close')">
      <div class="card panel">
        <header class="head">
          <div>
            <div class="section-title">DATA · 鼠标的数据表</div>
            <h2 class="title serif">企划运营数据</h2>
          </div>
          <button class="btn btn-ghost" @click="emit('close')">✕</button>
        </header>

        <div class="charts">
          <div class="chart-block">
            <div class="c-head">
              <span class="mono">粉丝增长曲线</span>
              <b class="mono gold">{{ fmtNum(game.totalFans) }}</b>
            </div>
            <canvas ref="fansCanvas" class="chart" />
          </div>
          <div class="chart-block">
            <div class="c-head">
              <span class="mono">资金余额</span>
              <b class="mono violet">¥{{ fmtMoney(game.gs.resources.money) }}</b>
            </div>
            <canvas ref="moneyCanvas" class="chart" />
          </div>
        </div>

        <div class="r2">
          <div class="r2-num mono">R² = {{ r2.toFixed(2) }}</div>
          <p class="r2-note serif">
            <template v-if="r2 < 0.5">模型拟合度偏低。鼠标说：「这说明还有上升空间。」</template>
            <template v-else-if="r2 < 0.8">模型勉强能用。鼠标把这张图打印出来贴在了显示器边框上。</template>
            <template v-else>模型拟合得非常好。鼠标看了一会儿，说：「太顺了，不对劲。」</template>
          </p>
        </div>

        <div class="table">
          <div class="t-head">
            <span>成员</span>
            <span v-for="k in STATS" :key="k">{{ STAT_LABELS[k] }}</span>
            <span>心态</span>
            <span>疲劳</span>
            <span>粉丝</span>
            <span>3D</span>
          </div>
          <div
            v-for="m in game.gs.idols"
            :key="m.id"
            class="t-row"
            :style="{ '--c': IDOL_BY_ID.get(m.id)!.color }"
          >
            <span class="m-name">{{ IDOL_BY_ID.get(m.id)!.nick }}</span>
            <span v-for="k in STATS" :key="k" class="mono num">{{ Math.round(m.stats[k]) }}</span>
            <span class="mono num" :class="{ bad: m.morale < 22 }">{{ Math.round(m.morale) }}</span>
            <span class="mono num" :class="{ warn: m.fatigue > 80 }">{{ Math.round(m.fatigue) }}</span>
            <span class="mono num">{{ fmtNum(m.fans) }}</span>
            <span class="mono num">{{ m.threeD ? '✓' : '—' }}</span>
          </div>
          <div class="t-row total">
            <span class="m-name">合计</span>
            <span v-for="k in STATS" :key="k" class="mono num">{{ Math.round(totalStats[k]) }}</span>
            <span class="mono num">{{ Math.round(game.avgMorale) }}</span>
            <span class="mono num">{{ Math.round(game.avgFatigue) }}</span>
            <span class="mono num">{{ fmtNum(game.totalFans) }}</span>
            <span class="mono num">{{ game.gs.idols.filter((i) => i.threeD).length }}/8</span>
          </div>
        </div>

        <div class="fin-head">
          <span class="section-title">INCOME · 本月收支预估</span>
          <span class="mono fin-cut">
            公会抽成 {{ Math.round(game.gs.resources.guildCut * 100) }}% · 平台抽成
            {{ Math.round(CONFIG.revenue.platformCut * 100) }}%
          </span>
        </div>
        <div class="fin">
          <div class="f-item">
            <span class="f-k">直播流水</span>
            <b class="mono">¥{{ fmtMoney(game.revenuePreview.gross) }}</b>
          </div>
          <div class="f-item">
            <span class="f-k">平台抽走</span>
            <b class="mono out">-¥{{ fmtMoney(game.revenuePreview.platform) }}</b>
          </div>
          <div class="f-item">
            <span class="f-k">公会分成</span>
            <b class="mono in">+¥{{ fmtMoney(game.revenuePreview.guild) }}</b>
          </div>
          <div class="f-item">
            <span class="f-k">主播分成</span>
            <b class="mono">¥{{ fmtMoney(game.revenuePreview.idols) }}</b>
          </div>
          <div class="f-item">
            <span class="f-k">
              周边与外快<template v-if="game.gs.merchLevel > 0">
                · 第 {{ game.gs.merchLevel }} 批 ×{{ game.revenuePreview.merchMul.toFixed(2) }}</template
              >
            </span>
            <b class="mono in">+¥{{ fmtMoney(game.revenuePreview.merch) }}</b>
          </div>
          <div class="f-item">
            <span class="f-k">
              月固定支出<template v-if="game.scaleCost > 0">
                · 含规模 {{ fmtMoney(game.scaleCost) }}</template
              >
            </span>
            <b class="mono out">-¥{{ fmtMoney(game.fixedCost) }}</b>
          </div>
        </div>
        <div class="fin-net">
          <span>本月净{{ game.revenuePreview.agency - game.fixedCost - game.pendingCost >= 0 ? '收入' : '亏损' }}</span>
          <b
            class="mono"
            :class="game.revenuePreview.agency - game.fixedCost - game.pendingCost >= 0 ? 'in' : 'out'"
          >
            {{ game.revenuePreview.agency - game.fixedCost - game.pendingCost >= 0 ? '+' : '-' }}¥{{
              fmtMoney(Math.abs(game.revenuePreview.agency - game.fixedCost - game.pendingCost))
            }}
          </b>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.card {
  width: min(880px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 22px 26px 24px;
  background: var(--sheet-2);
  animation: pop-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.title {
  margin-top: 3px;
  font-size: 21px;
  letter-spacing: 0.08em;
}

.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px 0;
}

.chart-block {
  border-radius: 12px;
  border: 1px solid var(--line);
  padding: 10px 12px 6px;
  background: var(--wash-1);
}

.c-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--dimmer);
  margin-bottom: 6px;
}
.c-head b {
  font-size: 15px;
}
.violet {
  color: var(--violet);
}

.chart {
  width: 100%;
  height: 92px;
  display: block;
}

.r2 {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--gold-line);
  background: rgba(255, 207, 107, 0.05);
  margin-bottom: 16px;
}

.r2-num {
  font-size: 20px;
  color: var(--gold);
  flex: 0 0 auto;
}

.r2-note {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--warm);
}

.table {
  border-radius: 12px;
  border: 1px solid var(--line);
  overflow: hidden;
}

.t-head,
.t-row {
  display: grid;
  grid-template-columns: 1.4fr repeat(4, 0.7fr) 0.7fr 0.7fr 1fr 0.5fr;
  align-items: center;
  padding: 7px 12px;
  gap: 4px;
  font-size: 11.5px;
}

.t-head {
  background: var(--wash-2);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--dimmer);
}

.t-row {
  border-top: 1px solid var(--wash-3);
}

.t-row.total {
  background: var(--wash-2);
  color: var(--dim);
}

.m-name {
  color: var(--idol-tone);
  font-size: 12px;
}

.num {
  text-align: right;
}
.num.bad {
  color: var(--red);
}
.num.warn {
  color: var(--amber);
}

.fin-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 18px;
  flex-wrap: wrap;
}

.fin-cut {
  font-size: 9.5px;
  color: var(--dimmer);
  letter-spacing: 0.06em;
}

.fin {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding-top: 10px;
}

.f-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
}

.f-k {
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--dimmer);
}

.f-item b {
  font-size: 14px;
}
.f-item b.in {
  color: var(--green);
}
.f-item b.out {
  color: var(--red-soft);
}

.fin-net {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--wash-2);
  font-size: 12px;
  color: var(--dim);
}

.fin-net b {
  font-size: 17px;
}
.fin-net b.in {
  color: var(--gold);
}
.fin-net b.out {
  color: var(--red);
}

.data-enter-active,
.data-leave-active {
  transition: opacity 0.2s ease;
}
.data-enter-from,
.data-leave-to {
  opacity: 0;
}

@media (max-width: 760px) {
  .charts {
    grid-template-columns: 1fr;
  }
  .t-head,
  .t-row {
    grid-template-columns: 1.2fr repeat(4, 0.6fr) 0.6fr 0.6fr 0.9fr 0.4fr;
    font-size: 10px;
    padding: 6px 8px;
  }
  .fin {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

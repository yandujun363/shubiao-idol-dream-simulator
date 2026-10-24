<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { ACTIONS, TAG_LABEL, type ActionDef, type ActionTag } from '../data/actions'
import { IDOL_BY_ID } from '../data/idols'
import { fmtMoney, fmtNum } from '../engine/balance'
import IdolIcon from './IdolIcon.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const game = useGameStore()

const tag = ref<ActionTag | 'all'>('all')
const selected = ref<ActionDef | null>(null)
const targets = ref<string[]>([])
const option = ref<string>('vocal')

const TAGS: (ActionTag | 'all')[] = ['all', 'daily', 'content', 'marketing', 'invest', 'rest']

const list = computed(() => (tag.value === 'all' ? ACTIONS : ACTIONS.filter((a) => a.tag === tag.value)))

function reset() {
  selected.value = null
  targets.value = []
  option.value = 'vocal'
}

watch(
  () => props.open,
  (o) => {
    if (o) reset()
  },
)

function lockOf(def: ActionDef): string | null {
  return game.lockReason(def)
}

function pick(def: ActionDef) {
  const reason = lockOf(def)
  if (reason) {
    game.notify(reason)
    return
  }
  selected.value = def
  targets.value = []
  option.value = 'vocal'
  if (def.targets.max === 0) {
    confirm()
  }
}

const candidates = computed(() => {
  if (!selected.value) return []
  return game.availableTargets(selected.value)
})

function toggleTarget(id: string) {
  if (!selected.value) return
  const max = selected.value.targets.max
  const idx = targets.value.indexOf(id)
  if (idx >= 0) targets.value.splice(idx, 1)
  else {
    if (targets.value.length >= max) {
      if (max === 1) targets.value = [id]
      else return
    } else targets.value.push(id)
  }
}

const needCount = computed(() => {
  if (!selected.value) return 0
  const { min, max } = selected.value.targets
  return max === 0 ? 0 : min
})

const valid = computed(() => {
  if (!selected.value) return false
  const { min, max } = selected.value.targets
  if (max === 0) return true
  return targets.value.length >= min && targets.value.length <= max
})

const preview = computed(() => {
  if (!selected.value) return null
  return game.previewOf({ uid: 'tmp', actionId: selected.value.id, targets: targets.value, option: option.value })
})

/** 目标还没选够时，涨粉预估没有意义 */
const previewReady = computed(() => {
  if (!selected.value) return false
  return selected.value.targets.max === 0 || targets.value.length >= selected.value.targets.min
})

/** 本月风向：这个行动吃到了推还是被压 */
function trendOf(id: string): { hot: boolean; mul: number; text: string } | null {
  const t = game.trend
  if (t.hot.id === id) return { hot: true, mul: t.hot.mul, text: t.hotLabel }
  if (t.cold.id === id) return { hot: false, mul: t.cold.mul, text: t.coldLabel }
  return null
}

const pctOf = (mul: number) => `${mul >= 1 ? '+' : ''}${Math.round((mul - 1) * 100)}%`

function confirm() {
  if (!selected.value) return
  if (!valid.value) {
    game.notify(`需要选择 ${needCount.value} 位成员`)
    return
  }
  game.addPending(selected.value.id, [...targets.value], option.value)
  reset()
}

function closeAll() {
  reset()
  emit('close')
}

const STAT_OPTIONS = [
  { key: 'vocal', label: '声乐' },
  { key: 'dance', label: '舞蹈' },
  { key: 'talk', label: '台本' },
  { key: 'charm', label: '表现' },
]
</script>

<template>
  <Transition name="modal">
    <div v-if="open" class="overlay" @click.self="closeAll">
      <div class="sheet panel">
        <header class="sheet-head">
          <div>
            <div class="section-title">ACTION · 安排行动</div>
            <h2 class="title serif">{{ selected ? selected.name : '本月要做什么' }}</h2>
          </div>
          <div class="head-right">
            <div class="res mono">
              <span>AP <b>{{ game.remainAp }}/{{ game.gs.resources.apMax }}</b></span>
              <span>资金 <b>¥{{ fmtMoney(game.gs.resources.money - game.pendingCost) }}</b></span>
            </div>
            <button class="btn btn-ghost close" @click="closeAll">✕</button>
          </div>
        </header>

        <!-- 第一步：选行动 -->
        <template v-if="!selected">
          <div class="trend-bar mono">
            <span class="tb-k">本月风向</span>
            <span class="tb-hot">↑ {{ game.trend.hot.name }} {{ pctOf(game.trend.hot.mul) }}</span>
            <span class="tb-cold">↓ {{ game.trend.cold.name }} {{ pctOf(game.trend.cold.mul) }}</span>
          </div>

          <div class="tags">
            <button
              v-for="t in TAGS"
              :key="t"
              class="tag"
              :class="{ on: tag === t }"
              @click="tag = t"
            >
              {{ t === 'all' ? '全部' : TAG_LABEL[t] }}
            </button>
          </div>

          <div class="grid">
            <button
              v-for="a in list"
              :key="a.id"
              class="action"
              :class="{ locked: !!lockOf(a) }"
              @click="pick(a)"
            >
              <div class="a-top">
                <span class="a-name serif">{{ a.name }}</span>
                <span class="a-ap mono">{{ a.ap }} AP</span>
              </div>
              <p class="a-desc">{{ a.desc }}</p>
              <div class="a-meta mono">
                <span>{{ a.money ? `¥${fmtMoney(a.money)}` : '免费' }}</span>
                <span v-if="a.targets.max > 0">{{ a.targets.min === a.targets.max ? a.targets.min : `${a.targets.min}-${a.targets.max}` }} 人</span>
                <span v-else>企划级</span>
                <span class="a-tag">{{ TAG_LABEL[a.tag] }}</span>
              </div>
              <span
                v-if="trendOf(a.id)"
                class="a-trend mono"
                :class="trendOf(a.id)!.hot ? 'hot' : 'cold'"
              >
                {{ trendOf(a.id)!.hot ? '↑ 风向' : '↓ 限流' }} {{ pctOf(trendOf(a.id)!.mul) }}
              </span>
              <div v-if="lockOf(a)" class="a-lock">{{ lockOf(a) }}</div>
            </button>
          </div>
        </template>

        <!-- 第二步：选人 -->
        <template v-else>
          <button class="back btn-ghost" @click="reset">← 换一个行动</button>

          <div class="two-col">
            <div class="pick-col">
              <div class="pick-head">
                <span class="section-title">选择成员</span>
                <span class="mono hint">
                  {{ selected.targets.max === 0 ? '无需选择' : `已选 ${targets.length} / ${selected.targets.max}` }}
                </span>
              </div>

              <div v-if="selected.targets.max === 0" class="no-target">
                这是一个企划级行动，不需要指定成员。
              </div>

              <div v-else class="members">
                <button
                  v-for="m in candidates"
                  :key="m.id"
                  class="member"
                  :class="{ on: targets.includes(m.id) }"
                  :style="{ '--c': IDOL_BY_ID.get(m.id)!.color }"
                  @click="toggleTarget(m.id)"
                >
                  <IdolIcon :id="m.id" :size="40" />
                  <div class="m-info">
                    <div class="m-name">{{ IDOL_BY_ID.get(m.id)!.nick }}</div>
                    <div class="m-sub mono">
                      {{ IDOL_BY_ID.get(m.id)!.name }} ·
                      {{ { vocal: '唱', dance: '舞', talk: '谈', charm: '现' }[selected.stat] }}
                      {{ Math.round(m.stats[selected.stat]) }}
                    </div>
                  </div>
                  <div class="m-state">
                    <span class="mono" :class="{ low: m.morale < 30 }">心{{ Math.round(m.morale) }}</span>
                    <span class="mono" :class="{ hot: m.fatigue > 70 }">疲{{ Math.round(m.fatigue) }}</span>
                  </div>
                </button>
              </div>

              <div v-if="selected.id === 'training'" class="opt-row">
                <span class="opt-label mono">训练方向</span>
                <button
                  v-for="o in STAT_OPTIONS"
                  :key="o.key"
                  class="opt"
                  :class="{ on: option === o.key }"
                  @click="option = o.key"
                >
                  {{ o.label }}
                </button>
              </div>
            </div>

            <div class="side-col">
              <div class="quip">
                <p class="serif">{{ selected.quip }}</p>
                <span class="mono">— 鼠标</span>
              </div>

              <div v-if="preview" class="estimate">
                <div class="est-row">
                  <span>预估粉丝</span>
                  <b v-if="previewReady" class="mono" :class="preview.fans > 0 ? 'up' : preview.fans < 0 ? 'down' : ''">
                    {{ preview.fans > 0 ? '+' : '' }}{{ fmtNum(preview.fans) }}
                  </b>
                  <b v-else class="mono faint">选人后估算</b>
                </div>
                <div v-if="previewReady && preview.fansHigh > preview.fans" class="est-row est-range">
                  <span>发挥区间</span>
                  <b class="mono faint">
                    {{ fmtNum(preview.fansLow) }} ~ {{ fmtNum(preview.fansHigh) }}
                  </b>
                </div>
                <div v-if="trendOf(selected.id)" class="est-row">
                  <span>{{ trendOf(selected.id)!.text }}</span>
                  <b class="mono" :class="trendOf(selected.id)!.hot ? 'up' : 'down'">
                    {{ pctOf(trendOf(selected.id)!.mul) }}
                  </b>
                </div>
                <div class="est-row">
                  <span>资金</span>
                  <b class="mono" :class="preview.money > 0 ? 'up' : preview.money < 0 ? 'down' : ''">
                    {{ preview.money > 0 ? '+' : preview.money < 0 ? '-' : '' }}¥{{ fmtMoney(Math.abs(preview.money)) }}
                  </b>
                </div>
                <div class="est-row">
                  <span>行动点</span>
                  <b class="mono">{{ selected.ap }} AP</b>
                </div>
                <div class="est-row">
                  <span>疲劳</span>
                  <b class="mono" :class="{ warn: selected.fatigue > 15 }">
                    {{ selected.fatigue > 0 ? `+${selected.fatigue}` : selected.fatigue }}
                  </b>
                </div>
                <p class="est-note">
                  预估是「运气正常」时的期望值。实际会在区间里落，偶尔爆款、偶尔翻车。
                </p>
              </div>

              <button class="btn btn-primary go" :disabled="!valid" @click="confirm">
                加入本月计划
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet {
  width: min(1000px, 100%);
  max-height: min(90vh, 880px);
  display: flex;
  flex-direction: column;
  padding: 20px 24px 22px;
  overflow: hidden;
  background: var(--sheet);
  animation: pop-in 0.26s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.title {
  margin-top: 4px;
  font-size: 24px;
  letter-spacing: 0.06em;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.res {
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: var(--dimmer);
}
.res b {
  color: var(--text);
  font-size: 13px;
}

.close {
  font-size: 16px;
  padding: 4px 8px;
}

.tags {
  display: flex;
  gap: 6px;
  padding: 14px 0 12px;
  flex-wrap: wrap;
}

.trend-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--wash-1);
  border-left: 2px solid var(--line-hi);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.tb-k {
  color: var(--dimmer);
  letter-spacing: 0.16em;
}

.tb-hot {
  color: var(--green);
}
.tb-cold {
  color: var(--red-soft);
}

.a-trend {
  position: absolute;
  top: 10px;
  right: 52px;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}
.a-trend.hot {
  color: var(--green);
  background: var(--good-bg);
}
.a-trend.cold {
  color: var(--red-soft);
  background: var(--danger-bg);
}

.est-range b {
  font-size: 11.5px;
}

.tag {
  padding: 4px 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  font-size: 12px;
  color: var(--dim);
  transition: all 0.16s ease;
}
.tag:hover {
  color: var(--text);
  border-color: var(--line-hi);
}
.tag.on {
  background: var(--gold-bg);
  border-color: var(--gold-line);
  color: var(--gold);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  overflow-y: auto;
  min-height: 0;
  flex: 1 1 auto;
  align-content: start;
  padding: 2px 6px 10px 2px;
}

.action {
  position: relative;
  text-align: left;
  padding: 12px 14px 11px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--wash-1);
  transition: all 0.18s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 96px;
}

.action:hover {
  border-color: rgba(255, 207, 107, 0.45);
  background: var(--gold-bg);
  transform: translateY(-2px);
}

.action.locked {
  opacity: 0.42;
}

.a-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.a-name {
  font-size: 15.5px;
  letter-spacing: 0.06em;
}

.a-ap {
  font-size: 10px;
  color: var(--gold);
  letter-spacing: 0.08em;
}

.a-desc {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--dim);
  flex: 1;
}

.a-meta {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: var(--dimmer);
}

.a-tag {
  margin-left: auto;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--line);
}

.a-lock {
  position: absolute;
  inset: auto 0 0 0;
  padding: 3px 14px;
  font-size: 10px;
  color: var(--red-soft);
  background: linear-gradient(180deg, transparent, rgba(255, 80, 100, 0.14));
  border-radius: 0 0 12px 12px;
}

.back {
  align-self: flex-start;
  font-size: 12px;
  padding: 10px 0 6px;
  color: var(--dim);
}
.back:hover {
  color: var(--text);
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
  min-height: 0;
  flex: 1;
  padding-top: 6px;
}

.pick-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.pick-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
}

.hint {
  font-size: 10px;
  color: var(--dimmer);
}

.no-target {
  padding: 30px 0;
  color: var(--dimmer);
  font-size: 12px;
  text-align: center;
}

.members {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 8px;
  overflow-y: auto;
  padding-right: 4px;
}

.member {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--wash-1);
  text-align: left;
  transition: all 0.16s ease;
  position: relative;
}

.member:hover {
  border-color: var(--line-hi);
  background: var(--wash-3);
}

.member.on {
  border-color: var(--c);
  background: color-mix(in srgb, var(--c) 12%, transparent);
  box-shadow: 0 0 0 1px var(--c) inset;
}

.m-info {
  flex: 1;
  min-width: 0;
}

.m-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--idol-tone);
}

.m-sub {
  font-size: 9px;
  color: var(--dimmer);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-state {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 9px;
  color: var(--dimmer);
  gap: 1px;
}
.m-state .low {
  color: var(--red-soft);
}
.m-state .hot {
  color: var(--amber);
}

.opt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  flex-wrap: wrap;
}

.opt-label {
  font-size: 10px;
  color: var(--dimmer);
  letter-spacing: 0.1em;
}

.opt {
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  font-size: 11.5px;
  color: var(--dim);
}
.opt.on {
  border-color: var(--violet);
  color: var(--violet);
  background: var(--violet-bg);
}

.side-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-left: 1px solid var(--line);
  padding-left: 18px;
}

.quip {
  padding: 14px;
  border-radius: 12px;
  background: var(--wash-2);
  border-left: 2px solid rgba(255, 207, 107, 0.45);
}
.quip p {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 1.85;
  color: var(--warm);
}
.quip span {
  font-size: 10px;
  color: var(--dimmer);
}

.estimate {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
}

.est-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 12px;
  color: var(--dim);
}
.est-row b {
  font-size: 13px;
  color: var(--text);
}
.est-row b.up {
  color: var(--green);
}
.est-row b.down {
  color: var(--red-soft);
}
.est-row b.warn {
  color: var(--gold);
}
.est-row b.faint {
  color: var(--dimmer);
  font-size: 11px;
}

.est-note {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.6;
  color: var(--dimmer);
}

.go {
  margin-top: auto;
  padding: 12px;
  font-size: 14px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.22s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (max-width: 860px) {
  .two-col {
    grid-template-columns: 1fr;
  }
  .side-col {
    border-left: none;
    padding-left: 0;
    border-top: 1px solid var(--line);
    padding-top: 12px;
  }
  .sheet {
    padding: 14px 14px 16px;
  }
  .title {
    font-size: 19px;
  }
}
</style>

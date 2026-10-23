import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef } from 'vue'
import type {
  EventOutcome,
  GameEvent,
  GameState,
  IdolState,
  LogLine,
  EndingResult,
  PendingAction,
  StatKey,
} from '../engine/types'
import { createInitialIdolState, IDOL_BY_ID, IDOLS } from '../data/idols'
import { ACTION_BY_ID, ACTIONS, type ActionDef } from '../data/actions'
import { EVENTS } from '../data/events'
import {
  BALANCE,
  CONFIG,
  fmtMoney,
  guildCutGrowthMul,
  guildCutMoraleCeiling,
  guildCutMoraleDelta,
  monthlyFixedCost,
  revenueSplit,
} from '../engine/balance'
import { Rng, uid } from '../engine/rng'
import {
  applyActionResult,
  effectiveStat,
  expectedFanGain,
  groupQuality,
  monthEnd,
  monthOpening,
  nameOf,
  resolveAction,
  synergy,
} from '../engine/resolve'
import { beBankrupt, beGraduation, evaluateLive, heEnding } from '../data/endings'
import type { LiveGrade } from '../data/endings'

export type Screen = 'title' | 'game' | 'live' | 'ending'
export type Phase = 'idle' | 'resolving' | 'event' | 'interlude'

const SAVE_KEY = 'mouse-idol-dream-v1'

/** 调试用：?phaseMonths=1 可以把每个阶段压缩成 1 个月（正式游戏恒为 12） */
const PHASE_MONTHS = (() => {
  try {
    const q = new URLSearchParams(window.location.search).get('phaseMonths')
    const n = q ? Number(q) : NaN
    const fallback = CONFIG.debug.phaseMonths
    return Number.isFinite(n) && n >= 1 && n <= 12 ? Math.floor(n) : fallback
  } catch {
    return 12
  }
})()

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

export function monthLabel(month: number): string {
  const year = Math.floor((month - 1) / 12) + 1
  const m = ((month - 1) % 12) + 1
  const season = m <= 3 ? '春' : m <= 6 ? '夏' : m <= 9 ? '秋' : '冬'
  return `第 ${year} 年 · 第 ${m} 月 · ${season}`
}

function createState(seed: number): GameState {
  return {
    phase: 1,
    month: 1,
    monthInPhase: 1,
    resources: {
      money: BALANCE.startMoney,
      reputation: 42,
      ap: CONFIG.actionPoints.perMonth,
      apMax: CONFIG.actionPoints.perMonth,
      guildCut: CONFIG.revenue.guildCutDefault,
      guildCutPerceived: CONFIG.revenue.guildCutDefault,
      guildCutPrev: CONFIG.revenue.guildCutDefault,
    },
    idols: createInitialIdolState(),
    endless: false,
    endlessMonth: 0,
    seenEvents: [],
    history: [
      {
        month: 0,
        label: '开局',
        fans: IDOLS.reduce((s, d) => s + d.fans, 0),
        money: BALANCE.startMoney,
        reputation: 42,
      },
    ],
    pending: [],
    ending: null,
    marketing: 1,
    buffs: { fanMul: 1, repBoost: 0, fatigueCut: 1 },
    achievements: [],
    flags: {},
    counters: {},
    seed,
  }
}

export const useGameStore = defineStore('game', () => {
  const screen = ref<Screen>('title')
  const phase = ref<Phase>('idle')
  const logs = ref<LogLine[]>([])
  const gs = reactive(createState(Date.now()))
  const currentEvent = ref<GameEvent | null>(null)
  const eventBody = ref<LogLine[]>([])
  const eventOptions = ref<{ label: string; hint?: string; cost?: number; disabled: boolean }[]>([])
  const liveGrade = ref<LiveGrade | null>(null)
  const ending = ref<EndingResult | null>(null)
  const rng = shallowRef<Rng>(new Rng(1))
  const toast = ref<string | null>(null)
  const monthSummary = ref<{ income: number; cost: number; net: number } | null>(null)

  let eventResolver: ((idx: number) => void) | null = null

  /* ---------------------------------------------------------------- */
  /* 派生数据                                                          */
  /* ---------------------------------------------------------------- */

  const totalFans = computed(() => gs.idols.reduce((s, i) => s + i.fans, 0))
  const avgMorale = computed(() => gs.idols.reduce((s, i) => s + i.morale, 0) / gs.idols.length)
  const avgFatigue = computed(() => gs.idols.reduce((s, i) => s + i.fatigue, 0) / gs.idols.length)
  const fixedCost = computed(() => {
    const raised = gs.flags['raised'] ? 1.2 : 1
    return Math.round(monthlyFixedCost(gs.phase) * raised)
  })
  const usedAp = computed(() => gs.pending.reduce((s, p) => s + (ACTION_BY_ID.get(p.actionId)?.ap ?? 0), 0))
  const remainAp = computed(() => gs.resources.apMax - usedAp.value)
  const pendingCost = computed(() => gs.pending.reduce((s, p) => s + (ACTION_BY_ID.get(p.actionId)?.money ?? 0), 0))
  const canAfford = computed(() => gs.resources.money >= pendingCost.value)

  const seasonLabel = computed(() => monthLabel(gs.month))

  /** 当前抽成率下的整月收入预估（按当前粉丝与口碑） */
  const revenuePreview = computed(() =>
    revenueSplit(totalFans.value, gs.resources.reputation, gs.resources.guildCut),
  )

  /** 当前抽成下，成员的心态变化与天花板 */
  const cutMoraleHint = computed(() => ({
    delta: guildCutMoraleDelta(gs.resources.guildCut),
    ceiling: Math.round(guildCutMoraleCeiling(gs.resources.guildCut)),
  }))

  function setGuildCut(value: number) {
    const min = CONFIG.revenue.guildCutMin
    const max = CONFIG.revenue.guildCutMax
    gs.resources.guildCut = Math.max(min, Math.min(max, value))
  }

  /* ---------------------------------------------------------------- */
  /* 工具                                                              */
  /* ---------------------------------------------------------------- */

  function notify(msg: string) {
    toast.value = msg
    setTimeout(() => {
      if (toast.value === msg) toast.value = null
    }, 2400)
  }

  function pushLog(line: LogLine) {
    logs.value.push(line)
    if (logs.value.length > 600) logs.value.splice(0, logs.value.length - 600)
  }

  async function pushLogs(lines: LogLine[], step = 55) {
    for (const l of lines) {
      pushLog(l)
      if (step > 0) await sleep(step)
    }
  }

  function reset(state: GameState) {
    Object.assign(gs, state)
    logs.value = []
    currentEvent.value = null
    eventOptions.value = []
    liveGrade.value = null
    ending.value = null
    monthSummary.value = null
  }

  function newGame(seed?: number) {
    const s = seed ?? Math.floor(Math.random() * 0xffffffff)
    rng.value = new Rng(s)
    reset(createState(s))
    screen.value = 'game'
    phase.value = 'idle'
    void openMonth()
  }

  async function openMonth() {
    const lines = monthOpening(gs, rng.value, monthLabel(gs.month))
    if (gs.month === 1) {
      lines.unshift(
        { kind: 'system', text: '【企划交接】' },
        { kind: 'narration', text: '前任负责人把一串钥匙、一张银行卡和一份企划书放在桌上，然后走了。' },
        { kind: 'narration', text: '银行里剩下 25 万。企划里剩下 8 个人。企划书上写着第一阶段，12 个月。' },
        { kind: 'quote', text: '“我不懂 V 圈。”', who: '你' },
        { kind: 'quote', text: '“没关系。我们也不太懂。”', who: '运营' },
        {
          kind: 'system',
          text: `每月固定支出 ¥${fmtMoney(monthlyFixedCost(1))}（8 人底薪 + 运营）。不增长，就会破产。`,
        },
      )
    }
    await pushLogs(lines, 80)
  }

  /* ---------------------------------------------------------------- */
  /* 编成（选行动）                                                     */
  /* ---------------------------------------------------------------- */

  function lockReason(def: ActionDef): string | null {
    if (usedAp.value + def.ap > gs.resources.apMax) return `行动点不足（需 ${def.ap} AP）`
    if (gs.resources.money < def.money + pendingCost.value) return `资金不足（需 ¥${def.money.toLocaleString()}）`
    return null
  }

  function availableTargets(def: ActionDef): IdolState[] {
    let list = [...gs.idols]
    if (def.targets.line && def.targets.line !== 'any') {
      list = list.filter((i) => IDOL_BY_ID.get(i.id)?.line === def.targets.line)
    }
    if (def.targets.need3D) list = list.filter((i) => i.threeD)
    if (def.oncePerMember) list = list.filter((i) => !i.threeD)
    return list
  }

  function addPending(actionId: string, targets: string[], option?: string) {
    const def = ACTION_BY_ID.get(actionId)
    if (!def) return
    const reason = lockReason(def)
    if (reason) {
      notify(reason)
      return
    }
    if (targets.length < def.targets.min || targets.length > def.targets.max) {
      notify(`需要选择 ${def.targets.min === def.targets.max ? def.targets.min : `${def.targets.min}-${def.targets.max}`} 位成员`)
      return
    }
    gs.pending.push({ uid: uid('p'), actionId, targets, option })
    gs.marketing = 1
    recalcMarketing()
  }

  /** 切片投放的加成在「排进去」的时候就体现在预估里 */
  function recalcMarketing() {
    const hasClip = gs.pending.some((p) => p.actionId === 'clip')
    gs.marketing = hasClip ? 1.28 : 1
  }

  function removePending(id: string) {
    const idx = gs.pending.findIndex((p) => p.uid === id)
    if (idx >= 0) gs.pending.splice(idx, 1)
    recalcMarketing()
  }

  function clearPending() {
    gs.pending = []
    recalcMarketing()
  }

  function previewOf(p: PendingAction): { fans: number; money: number; ap: number } {
    const def = ACTION_BY_ID.get(p.actionId)!
    const targets = p.targets
      .map((id) => gs.idols.find((i) => i.id === id))
      .filter((x): x is IdolState => !!x)

    if (p.actionId === 'clip') return { fans: Math.round(totalFans.value * 0.014), money: -def.money, ap: def.ap }
    if (p.actionId === 'review') return { fans: Math.round(totalFans.value * 0.004), money: -def.money, ap: def.ap }
    if (p.actionId === 'sponsor') {
      const used = gs.pending.filter((x) => x.actionId === 'sponsor').indexOf(p)
      const fade = Math.max(0.25, 1 - used * 0.35)
      const q = targets.length ? groupQuality(targets, 'charm') : 0.8
      return { fans: Math.round(-totalFans.value * 0.004 * used), money: Math.round(totalFans.value * 0.3 * fade * (0.85 + q * 0.25)), ap: def.ap }
    }
    if (def.base <= 0) return { fans: 0, money: -def.money, ap: def.ap }
    const q = groupQuality(targets, def.stat)
    const syn = synergy(targets).mul
    const fans = Math.round(
      def.base *
        Math.pow(Math.max(q, 0.08), 0.95) *
        Math.sqrt(1 + totalFans.value / BALANCE.fanScale) *
        syn *
        gs.marketing *
        gs.buffs.fanMul *
        guildCutGrowthMul(gs.resources.guildCutPerceived),
    )
    return { fans, money: -def.money, ap: def.ap }
  }

  /* ---------------------------------------------------------------- */
  /* 执行一个月                                                        */
  /* ---------------------------------------------------------------- */

  async function executeMonth() {
    if (phase.value !== 'idle') return
    if (!gs.pending.length) {
      notify('至少安排一个行动')
      return
    }
    phase.value = 'resolving'

    const snapshot = [...gs.pending]
    gs.pending = []
    // 切片投放：整月生效，不论先后顺序
    gs.marketing = snapshot.some((p) => p.actionId === 'clip') ? 1.28 : 1

    pushLog({ kind: 'system', text: `【企划执行 · ${monthLabel(gs.month)}】` })
    await sleep(140)

    for (const p of snapshot) {
      const def = ACTION_BY_ID.get(p.actionId)
      if (!def) continue
      const res = resolveAction(def, p.targets, gs, rng.value, p.option)
      gs.counters[p.actionId] = (gs.counters[p.actionId] ?? 0) + 1
      applyActionResult(gs, res)
      await pushLogs(res.logs, 70)
      await sleep(110)
    }

    // 行动点恢复前的缓冲
    await sleep(120)

    const end = monthEnd(gs, rng.value, { fixedCost: fixedCost.value, phase: gs.phase })
    await pushLogs(end.logs, 75)

    monthSummary.value = { income: end.income, cost: end.cost, net: end.income - end.cost }

    for (const s of end.sick) {
      pushLog({ kind: 'bad', text: `${s} 病倒了。下个月行动点 -1。` })
    }
    gs.resources.apMax = end.sick.length ? CONFIG.actionPoints.sickPenalty : CONFIG.actionPoints.perMonth

    /* --- 失败判定（无限流模式下只跑数据，不结束） --- */
    if (!gs.endless && end.graduations.length) {
      ending.value = beGraduation(gs, end.graduations)
      finish('be')
      return
    }
    if (!gs.endless && end.bankrupt) {
      ending.value = beBankrupt(gs)
      finish('be')
      return
    }

    /* --- 记录曲线 --- */
    gs.history.push({
      month: gs.month,
      label: monthLabel(gs.month),
      fans: totalFans.value,
      money: gs.resources.money,
      reputation: gs.resources.reputation,
    })

    /* --- 随机事件 --- */
    const ev = rollEvent()
    if (ev) {
      await sleep(160)
      await runEvent(ev)
      if (ending.value) return
    }

    /* --- 推进时间 --- */
    await advanceTime()
  }

  async function advanceTime() {
    if (gs.endless) gs.endlessMonth += 1
    const finishedPhase = !gs.endless && gs.monthInPhase >= PHASE_MONTHS
    const wasPhase = gs.phase
    gs.month += 1
    gs.monthInPhase = finishedPhase ? 1 : gs.monthInPhase + 1

    // 月度重置
    gs.marketing = 1
    gs.buffs = { fanMul: 1, repBoost: 0, fatigueCut: 1 }
    gs.counters = {}
    gs.resources.ap = gs.resources.apMax

    if (finishedPhase && wasPhase === 1) {
      gs.phase = 2
      await sleep(300)
      await pushLogs([
        { kind: 'system', text: '═══ 第一阶段结束 ═══' },
        { kind: 'narration', text: '12 个月。企划没有破产，也没有人走。' },
        { kind: 'narration', text: '运营把一份新的文件放在你桌上，封面上写着：线上演唱会 Live · 制作方案。' },
        { kind: 'quote', text: '“接下来这 12 个月，我们只有一件事要做。”', who: '鼠标' },
        { kind: 'quote', text: '“让八个人站上同一个线上舞台。”', who: '鼠标' },
        { kind: 'system', text: '第二阶段开始。固定支出上涨。' },
      ], 110)
    }

    if (finishedPhase && wasPhase === 2) {
      await sleep(400)
      await goLive()
      return
    }

    phase.value = 'idle'
    await openMonth()
    save()
  }

  /* ---------------------------------------------------------------- */
  /* 事件                                                              */
  /* ---------------------------------------------------------------- */

  function makeCtx() {
    return {
      money: gs.resources.money,
      fans: totalFans.value,
      reputation: gs.resources.reputation,
      idols: gs.idols,
      pick: (ids: IdolState[]) => ids.filter(Boolean),
      rand: () => rng.value.next(),
      state: gs,
    }
  }

  function rollEvent(): GameEvent | null {
    if (gs.endless) return null
    const ctx = makeCtx()

    // 毕业谈话优先级最高
    const dying = gs.idols.find((i) => i.gradRisk >= 1)
    if (dying) {
      const talk = EVENTS.find((e) => e.id === 'graduation_talk')!
      return talk
    }

    if (!rng.value.chance(CONFIG.events.chancePerMonth)) return null

    const pool = EVENTS.filter(
      (e) => e.id !== 'graduation_talk' && e.when(ctx) && (!gs.seenEvents.includes(e.id) || e.repeatable),
    )
    if (!pool.length) return null

    const weights = pool.map((e) => e.weight ?? 5)
    const total = weights.reduce((s, w) => s + w, 0)
    let r = rng.value.next() * total
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]
      if (r <= 0) return pool[i]
    }
    return pool[pool.length - 1]
  }

  async function runEvent(ev: GameEvent) {
    phase.value = 'event'
    const ctx = makeCtx()
    gs.seenEvents.push(ev.id)
    const body = ev.body(ctx)
    eventBody.value = body
    await pushLogs([{ kind: 'event', text: `◆ ${ev.title}` }, ...body], 85)
    const choices = ev.choices(ctx)
    eventOptions.value = choices.map((c) => ({
      label: c.label,
      hint: c.hint,
      cost: c.cost,
      disabled: !!c.cost && gs.resources.money < c.cost,
    }))
    currentEvent.value = ev

    const idx = await new Promise<number>((res) => {
      eventResolver = res
    })
    currentEvent.value = null
    eventOptions.value = []
    eventBody.value = []

    const choice = choices[idx]
    const out = choice.apply(makeCtx())
    applyOutcome(out)
    await pushLogs(out.logs, 80)

    if (out.graduate && out.graduate.length) {
      await sleep(300)
      ending.value = beGraduation(gs, out.graduate)
      finish('be')
      return
    }

    phase.value = 'idle'
  }

  function chooseEvent(idx: number) {
    if (eventOptions.value[idx]?.disabled) {
      notify('资金不足')
      return
    }
    eventResolver?.(idx)
    eventResolver = null
  }

  function applyOutcome(out: EventOutcome) {
    if (out.money) gs.resources.money += out.money
    if (out.reputation) gs.resources.reputation = Math.max(0, Math.min(100, gs.resources.reputation + out.reputation))
    if (out.fans) {
      const total = totalFans.value || 1
      gs.idols.forEach((i) => {
        const gain = Math.round((out.fans! * i.fans) / total)
        i.fans = Math.max(0, i.fans + gain)
      })
    }
    if (out.morale) {
      const ids = out.morale.all ? gs.idols.map((i) => i.id) : (out.morale.ids ?? [])
      for (const id of ids) {
        const i = gs.idols.find((x) => x.id === id)
        if (i) i.morale = Math.max(-5, Math.min(100, i.morale + out.morale.delta))
      }
    }
    if (out.fatigue) {
      const ids = out.fatigue.all ? gs.idols.map((i) => i.id) : (out.fatigue.ids ?? [])
      for (const id of ids) {
        const i = gs.idols.find((x) => x.id === id)
        if (i) i.fatigue = Math.max(0, Math.min(130, i.fatigue + out.fatigue.delta))
      }
    }
    if (out.stat) {
      const ids = out.stat.ids ?? []
      for (const id of ids) {
        const i = gs.idols.find((x) => x.id === id)
        if (i) i.stats[out.stat!.key] = Math.min(99, i.stats[out.stat!.key] + out.stat.delta)
      }
    }
    if (out.flags) Object.assign(gs.flags, out.flags)
  }

  /* ---------------------------------------------------------------- */
  /* Live & 结局                                                       */
  /* ---------------------------------------------------------------- */

  const STAGE_COST = CONFIG.live.venueCost

  async function goLive() {
    phase.value = 'interlude'
    // 存档里的键名沿用 grandVenue，改演出形式时不动它，免得旧存档读不出来
    const canAffordStage = gs.resources.money >= STAGE_COST
    if (canAffordStage) {
      gs.resources.money -= STAGE_COST
      gs.flags['grandVenue'] = true
    }
    await pushLogs(
      [
        { kind: 'system', text: '═══ 第二阶段结束 · 线上演唱会 Live ═══' },
        { kind: 'narration', text: '24 个月。账上的数字、数据表上的曲线、还有八个人的心跳。' },
        { kind: 'narration', text: '今天，全部要在同一个直播间里摊开。' },
        canAffordStage
          ? { kind: 'good', text: `制作费付了。¥${STAGE_COST.toLocaleString()}，虚拟舞台、导播组、推流带宽全部拉满。` }
          : { kind: 'bad', text: '制作费凑不出来。最后只剩一个默认场景和一台推流机，舞美全部砍掉。' },
      ],
      120,
    )
    liveGrade.value = evaluateLive(gs)
    screen.value = 'live'
  }

  function concludeLive() {
    const grade = liveGrade.value!
    ending.value = heEnding(gs, grade)
    finish('he')
  }

  function finish(_kind: 'he' | 'be') {
    screen.value = 'ending'
    phase.value = 'idle'
    save()
  }

  function startEndless() {
    if (!ending.value || ending.value.type !== 'HE') return
    gs.endless = true
    gs.endlessMonth = 1
    screen.value = 'game'
    ending.value = null
    liveGrade.value = null
    phase.value = 'idle'
    void pushLogs(
      [
        { kind: 'system', text: '═══ 无限流模式 ═══' },
        { kind: 'narration', text: '梦已经做完了。接下来是数据。' },
        { kind: 'quote', text: '“继续跑吧。我想看看这条曲线能到哪。”', who: '鼠标' },
        { kind: 'system', text: '此模式下不再有剧情事件，只有纯数据推演。' },
      ],
      100,
    )
    save()
  }

  /* ---------------------------------------------------------------- */
  /* 存档                                                              */
  /* ---------------------------------------------------------------- */

  function save() {
    if (isPreview.value) return
    try {
      const data = { gs, logs: logs.value.slice(-200), screen: screen.value, seed: gs.seed }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      /* ignore */
    }
  }

  function hasSave(): boolean {
    try {
      return !!localStorage.getItem(SAVE_KEY)
    } catch {
      return false
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw)
      if (!data?.gs) return false
      rng.value = new Rng(data.seed ?? Date.now())
      Object.assign(gs, data.gs)
      // 兼容旧存档：补上后来才加的字段
      const r = gs.resources
      if (typeof r.guildCut !== 'number') r.guildCut = CONFIG.revenue.guildCutDefault
      if (typeof r.guildCutPerceived !== 'number') r.guildCutPerceived = r.guildCut
      if (typeof r.guildCutPrev !== 'number') r.guildCutPrev = r.guildCut
      if (!gs.counters) gs.counters = {}
      logs.value = data.logs ?? []
      screen.value = 'game'
      phase.value = 'idle'
      save()
      return true
    } catch {
      return false
    }
  }

  /** 开发用：直接预览 Live 舞台（?preview=stage&fans=200000&threed=8） */
  const isPreview = ref(false)

  function previewStage(opts: { fans?: number; threeD?: number } = {}) {
    isPreview.value = true
    const total = opts.fans ?? 200_000
    const threeD = opts.threeD ?? 8
    gs.idols.forEach((i, idx) => {
      i.fans = Math.round(total / gs.idols.length)
      i.threeD = idx < threeD
      i.morale = 70
      i.fatigue = 30
      i.stats = { vocal: 78, dance: 74, talk: 68, charm: 72 }
    })
    gs.resources.reputation = 76
    gs.resources.money = 900_000
    gs.flags['grandVenue'] = true
    liveGrade.value = evaluateLive(gs)
    screen.value = 'live'
  }

  function backToTitle() {
    screen.value = 'title'
    phase.value = 'idle'
    logs.value = []
    currentEvent.value = null
    ending.value = null
    liveGrade.value = null
  }

  function wipe() {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* ignore */
    }
  }

  /* ---------------------------------------------------------------- */
  /* 展示辅助                                                          */
  /* ---------------------------------------------------------------- */

  function idolDef(id: string) {
    return IDOL_BY_ID.get(id)!
  }

  function statOf(id: string, key: StatKey) {
    const i = gs.idols.find((x) => x.id === id)!
    return i.stats[key]
  }

  function effOf(id: string, key: StatKey) {
    const i = gs.idols.find((x) => x.id === id)!
    return effectiveStat(i, key)
  }

  function expectedOf(p: PendingAction) {
    const def = ACTION_BY_ID.get(p.actionId)!
    const targets = p.targets.map((id) => gs.idols.find((i) => i.id === id)!).filter(Boolean)
    return expectedFanGain(def, gs as GameState, targets)
  }

  return {
    // state
    screen,
    phase,
    logs,
    gs,
    currentEvent,
    eventBody,
    eventOptions,
    liveGrade,
    ending,
    toast,
    monthSummary,
    // derived
    totalFans,
    revenuePreview,
    cutMoraleHint,
    setGuildCut,
    avgMorale,
    avgFatigue,
    fixedCost,
    usedAp,
    remainAp,
    pendingCost,
    canAfford,
    seasonLabel,
    // actions
    newGame,
    executeMonth,
    addPending,
    removePending,
    clearPending,
    lockReason,
    availableTargets,
    previewOf,
    expectedOf,
    chooseEvent,
    concludeLive,
    startEndless,
    save,
    load,
    hasSave,
    wipe,
    backToTitle,
    previewStage,
    idolDef,
    statOf,
    effOf,
    notify,
    nameOf,
    ACTIONS,
  }
})

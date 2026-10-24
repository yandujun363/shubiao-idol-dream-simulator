import type {
  ActionResult,
  GameState,
  IdolState,
  LogLine,
  LuckRoll,
  StatKey,
} from './types'
import type { ActionDef } from '../data/actions'
import { ACTION_BY_ID } from '../data/actions'
import { ACTION_NARRATION, MOUSE_QUOTES, FAN_QUOTES, type Tier } from '../data/narration'
import { IDOL_BY_ID } from '../data/idols'
import {
  BALANCE,
  CONFIG,
  fanScale,
  guildCutGrowthMul,
  guildCutMoraleCeiling,
  guildCutMoraleDelta,
  guildCutReputationDelta,
  revenueSplit,
} from './balance'
import { luckBounds, rollLuck } from './luck'
import { monthTrend, trendConfig, trendMulOf } from './trend'
import type { Rng } from './rng'

/* ------------------------------------------------------------------ */
/* 基础计算                                                            */
/* ------------------------------------------------------------------ */

/** 疲劳与心态对发挥的修正 */
export function performanceMul(i: IdolState): number {
  const fat = 1 - Math.min(i.fatigue, 120) / 400
  const mor = 0.72 + Math.max(0, Math.min(100, i.morale)) / 240
  return Math.max(0.25, fat * mor)
}

export function effectiveStat(i: IdolState, key: StatKey): number {
  return i.stats[key] * performanceMul(i)
}

/** 多人平均发挥水平，1.0 ≈ 综合能力 50 */
export function groupQuality(ids: IdolState[], key: StatKey): number {
  if (!ids.length) return 0
  const avg = ids.reduce((s, i) => s + effectiveStat(i, key), 0) / ids.length
  return avg / 50
}

/** 光芒 × 宝石 的化学反应 */
export function synergy(ids: IdolState[]): { mul: number; note: string | null } {
  if (ids.length < 2) return { mul: 1, note: null }
  const hasLight = ids.some((i) => IDOL_BY_ID.get(i.id)?.line === 'light')
  const hasGem = ids.some((i) => IDOL_BY_ID.get(i.id)?.line === 'gem')
  if (hasLight && hasGem) return { mul: 1.12, note: '光芒系 × 宝石系，化学反应加成' }
  return { mul: 1.04, note: '同系联动，默契加成' }
}

function interpolate(tpl: string, names: string[], romaji: string): string {
  const n = names[0] ?? '成员'
  const n2 = names[1] ?? names[0] ?? '成员'
  return tpl
    .replaceAll('{n2}', n2)
    .replaceAll('{n}', n)
    .replaceAll('{names}', names.join('、'))
    .replaceAll('{r}', romaji)
}

export function nameOf(id: string): string {
  return IDOL_BY_ID.get(id)?.name ?? id
}

function pickNarration(actionId: string, tier: Tier, ids: IdolState[], rng: Rng): string {
  const pool = ACTION_NARRATION[actionId]
  if (!pool) return ''
  const lines = pool[tier]
  const tpl = rng.pick(lines)
  const names = ids.map((i) => nameOf(i.id))
  const romaji = ids[0] ? (IDOL_BY_ID.get(ids[0].id)?.romaji ?? '') : ''
  return interpolate(tpl, names, romaji)
}

/* ------------------------------------------------------------------ */
/* 行动结算                                                            */
/* ------------------------------------------------------------------ */

export function expectedFanGain(action: ActionDef, state: GameState, targets: IdolState[]): number {
  return estimateFanGain(action, state, targets).mid
}

/**
 * 一次行动的涨粉预估。
 *
 * mid 是「运气正常」时的期望值，low / high 是这个行动能吃到的浮动下界与上界
 * （来自爆款 / 翻车的尾巴）。UI 上显示成区间，玩家就不会觉得数字是写死的。
 */
export function estimateFanGain(
  action: ActionDef,
  state: GameState,
  targets: IdolState[],
): { low: number; mid: number; high: number } {
  if (action.base <= 0) return { low: 0, mid: 0, high: 0 }
  const q = targets.length ? groupQuality(targets, action.stat) : 1
  const total = state.idols.reduce((s, i) => s + i.fans, 0)
  const base =
    action.base *
    Math.pow(Math.max(q, 0.1), 0.95) *
    fanScale(total) *
    synergy(targets).mul *
    trendMulOf(monthTrend(state.seed, state.month), action.id) *
    state.marketing *
    state.buffs.fanMul *
    guildCutGrowthMul(state.resources.guildCutPerceived)
  const b = luckBounds(action.luck)
  return {
    low: Math.round(base * b.low),
    mid: Math.round(base),
    high: Math.round(base * b.high),
  }
}

export function resolveAction(
  action: ActionDef,
  targetIds: string[],
  state: GameState,
  rng: Rng,
  option?: string,
): ActionResult {
  const logs: LogLine[] = []
  const targets = targetIds
    .map((id) => state.idols.find((i) => i.id === id))
    .filter((x): x is IdolState => !!x)

  const totalFans = state.idols.reduce((s, i) => s + i.fans, 0)
  let fanDelta = 0
  let moneyDelta = -action.money
  let repDelta = action.rep
  /** 通用内容行动的发挥档位（特殊行动不报） */
  let luckLabel = ''
  let luckRoll: LuckRoll | undefined

  const deltas: ActionResult['idolDeltas'] = targets.map((t) => ({ id: t.id }))
  const [n0] = targets.map((t) => nameOf(t.id))

  logs.push({
    kind: 'action',
    text: action.name,
    who: targets.length ? targets.map((t) => nameOf(t.id)).join(' + ') : '企划',
    color: '#ffcf6b',
  })

  /* ---------- 特殊行动 ---------- */

  const clipBoost = action.boost ?? 1.28
  const reviewBoost = action.reviewBoost ?? 1.18

  if (action.id === 'clip') {
    fanDelta = Math.round(totalFans * 0.014 * rng.range(0.8, 1.25))
    logs.push({
      kind: 'system',
      text: `切片投放：本月全部内容涨粉 +${Math.round((clipBoost - 1) * 100)}%。投放本身带来 ${fanDelta.toLocaleString()} 关注。`,
    })
  } else if (action.id === 'review') {
    state.nextFanMul *= reviewBoost
    fanDelta = Math.round(totalFans * 0.004)
    const verdicts = [
      '近三十天的涨粉曲线拟合完成了。R² = 0.31。',
      '交叉分析结果：互动率和留存的相关系数是 0.44，和时长的相关系数是 0.12。',
      '模型跑完了。结论是：没有结论。但至少排除了三种可能。',
      '数据表扩到 42 列了。其中 9 列是空的。',
    ]
    logs.push({ kind: 'quote', text: rng.pick(verdicts), who: '鼠标' })
    logs.push({
      kind: 'system',
      text: `下月全部内容涨粉 +${Math.round((reviewBoost - 1) * 100)}%。全企划：心情 -1（被拉表的恐惧）。`,
    })
  } else if (action.id === 'sponsor') {
    const used = state.counters['sponsor'] ?? 0
    const fadeStep = action.sponsorFade ?? 0.35
    const fade = Math.max(0.25, 1 - used * fadeStep)
    const q = targets.length ? groupQuality(targets, 'charm') : 0.8
    const rate = action.sponsorRate ?? 0.3
    const income = Math.round(totalFans * rate * fade * (0.85 + q * 0.25) * rng.range(0.85, 1.3))
    moneyDelta += income
    fanDelta = -Math.round(totalFans * 0.004 * used)
    repDelta = -3 - used
    logs.push({
      kind: 'good',
      text: `商务到账 ¥${income.toLocaleString()}。（不计入流水，平台不抽，公会不抽）`,
      who: '财务',
    })
    if (used > 0) logs.push({ kind: 'bad', text: `这个月已经是第 ${used + 1} 条商务了。评论区开始有人数数。` })
  } else if (action.id === 'rest') {
    targets.forEach((t) => {
      const d = deltas.find((x) => x.id === t.id)!
      d.fatigue = action.fatigue * rng.range(0.9, 1.1)
      d.morale = action.morale
    })
    const who = targets.map((t) => nameOf(t.id)).join('、')
    logs.push({ kind: 'result', text: `${who} 关掉直播，睡了几天。` })
    logs.push({ kind: 'good', text: `疲劳大幅下降，心态回升。` })
  } else if (action.id === 'training') {
    const key = (option as StatKey) || 'vocal'
    const label = { vocal: '声乐', dance: '舞蹈', talk: '台本', charm: '表现' }[key]
    targets.forEach((t) => {
      const d = deltas.find((x) => x.id === t.id)!
      const gain = 2.6 * rng.range(0.75, 1.3) * performanceMul(t)
      d.stats = { [key]: gain } as Partial<Record<StatKey, number>>
      d.fatigue = action.fatigue * rng.range(0.85, 1.15)
      d.morale = action.morale
    })
    logs.push({ kind: 'result', text: `${label}课。${targets.map((t) => nameOf(t.id)).join('、')} 各练了四周。` })
  } else if (action.id === 'three_d') {
    const t = targets[0]
    if (t) {
      t.threeD = true
      const d = deltas.find((x) => x.id === t.id)!
      d.threeD = true
      d.morale = action.morale
      d.fatigue = action.fatigue
    }
    fanDelta = Math.round(900 * fanScale(totalFans) * rng.range(0.9, 1.15))
    logs.push({ kind: 'good', text: `${n0} 的 3D 模型完成。可以上台了。` })
  } else {
    /* ---------- 通用内容行动 ---------- */

    const q = groupQuality(targets, action.stat)
    const syn = synergy(targets)
    const trendMul = trendMulOf(monthTrend(state.seed, state.month), action.id)
    const luck = rollLuck(rng, action.luck)
    const raw = action.base * Math.pow(Math.max(q, 0.08), 0.95) * fanScale(totalFans) * syn.mul * trendMul
    fanDelta = Math.round(
      raw *
        state.marketing *
        state.buffs.fanMul *
        guildCutGrowthMul(state.resources.guildCutPerceived) *
        luck.mul,
    )

    const tier = luck.tier
    luckLabel = luck.label
    luckRoll = luck

    // 整活额外吃口碑与心态：爆了大家都开心，翻车了要被剪成吐槽视频
    if (action.id === 'variety') {
      if (luck.extreme === 'surge') {
        repDelta += 3
        logs.push({ kind: 'good', text: '爆了。这期整活真的爆了。', who: '运营' })
      } else if (luck.extreme === 'flop') {
        repDelta -= 4
        targets.forEach((t) => {
          const d = deltas.find((x) => x.id === t.id)!
          d.morale = (d.morale ?? 0) - 6
        })
        logs.push({ kind: 'bad', text: '翻车了。而且是被别人剪成吐槽视频的那种翻车。', who: '运营' })
      }
    }

    const text = pickNarration(action.id, tier, targets, rng)
    if (text) logs.push({ kind: 'narration', text })

    if (syn.note) logs.push({ kind: 'system', text: syn.note })
    if (trendMul !== 1) {
      logs.push({
        kind: 'system',
        text: `本月平台风向：${action.name} ${trendMul > 1 ? '被推' : '被压'}（×${trendMul.toFixed(2)}）。`,
      })
    }

    // 属性成长 + 疲劳 + 心态
    targets.forEach((t) => {
      const d = deltas.find((x) => x.id === t.id)!
      const growth: Partial<Record<StatKey, number>> = {}
      for (const [k, v] of Object.entries(action.grow)) {
        const before = t.stats[k as StatKey]
        const add = v * rng.range(0.7, 1.4) * (1 + (100 - before) / 200)
        growth[k as StatKey] = Math.min(add, 99 - before)
      }
      d.stats = growth
      d.fatigue = action.fatigue * rng.range(0.85, 1.2) * state.buffs.fatigueCut
      d.morale = action.morale + (tier === 'crit' ? 4 : tier === 'good' ? 1 : 0)
    })
  }

  /* ---------- 结果播报 ---------- */

  const qualNote =
    fanDelta > 0
      ? `粉丝 +${fanDelta.toLocaleString()}`
      : fanDelta < 0
        ? `粉丝 ${fanDelta.toLocaleString()}`
        : '粉丝无变化'

  // 只有在发挥明显偏离时才报档位，正常发挥不刷屏
  const luckNote = luckLabel && luckLabel !== '正常发挥' ? ` · ${luckLabel}` : ''

  logs.push({
    kind: 'result',
    text: `${qualNote}${luckNote}${moneyDelta !== 0 ? ` · 资金 ${moneyDelta > 0 ? '+' : '-'}¥${Math.abs(moneyDelta).toLocaleString()}` : ''}${repDelta ? ` · 口碑 ${repDelta > 0 ? '+' : ''}${repDelta.toFixed(1)}` : ''}`,
  })

  return { logs, fanDelta, moneyDelta, repDelta, luck: luckRoll, idolDeltas: deltas }
}

/* ------------------------------------------------------------------ */
/* 结算应用                                                            */
/* ------------------------------------------------------------------ */

export function applyActionResult(state: GameState, res: ActionResult): void {
  state.resources.money += res.moneyDelta
  state.resources.reputation = Math.max(0, Math.min(100, state.resources.reputation + res.repDelta))

  // 涨粉按「本行动参与者」分配，无参与者则按现有粉丝比例分配
  const participants = res.idolDeltas.filter((d) => d.fans !== 0 || d.stats || d.fatigue || d.morale)
  if (res.fanDelta !== 0) {
    const totalFans = state.idols.reduce((s, i) => s + i.fans, 0) || 1
    if (participants.length) {
      const weights = participants.map((d) => {
        const idol = state.idols.find((i) => i.id === d.id)!
        return 1 + idol.stats.charm / 100
      })
      const wsum = weights.reduce((s, w) => s + w, 0)
      participants.forEach((d, idx) => {
        const idol = state.idols.find((i) => i.id === d.id)!
        const gain = Math.round((res.fanDelta * weights[idx]) / wsum)
        idol.fans = Math.max(0, idol.fans + gain)
        idol.contributed += Math.max(0, gain)
      })
    } else {
      state.idols.forEach((idol) => {
        const gain = Math.round((res.fanDelta * idol.fans) / totalFans)
        idol.fans = Math.max(0, idol.fans + gain)
        idol.contributed += Math.max(0, gain)
      })
    }
  }

  for (const d of res.idolDeltas) {
    const idol = state.idols.find((i) => i.id === d.id)
    if (!idol) continue
    if (d.stats) {
      for (const [k, v] of Object.entries(d.stats)) {
        const key = k as StatKey
        idol.stats[key] = Math.max(1, Math.min(99, idol.stats[key] + (v ?? 0)))
      }
    }
    if (d.morale) idol.morale = Math.max(-5, Math.min(100, idol.morale + d.morale))
    if (d.fatigue) idol.fatigue = Math.max(0, Math.min(130, idol.fatigue + d.fatigue))
    if (d.threeD) idol.threeD = true
  }
}

/* ------------------------------------------------------------------ */
/* 月末结算                                                            */
/* ------------------------------------------------------------------ */

export interface MonthEndResult {
  logs: LogLine[]
  income: number
  cost: number
  /** 收入拆解（流水 / 平台 / 公会 / 主播 / 周边） */
  split: ReturnType<typeof revenueSplit>
  bankrupt: boolean
  graduations: string[]
  sick: string[]
  warned: string[]
}

export interface MonthEndOptions {
  fixedCost: number
  phase: 1 | 2
  /** 固定支出里的规模成本，只为账本拆开展示用 */
  scaleCost?: number
}

export function monthEnd(state: GameState, rng: Rng, opts: MonthEndOptions): MonthEndResult {
  const logs: LogLine[] = []
  const totalFans = state.idols.reduce((s, i) => s + i.fans, 0)

  /* 分成：成员记住的是长期分成，这个月的数字要慢慢渗透进去 */
  const G = CONFIG.revenue.guildCut
  const actualCut = state.resources.guildCut
  const perceived = state.resources.guildCutPerceived + (actualCut - state.resources.guildCutPerceived) * G.adaptSpeed
  state.resources.guildCutPerceived = perceived
  const cutChanged = Math.abs(actualCut - state.resources.guildCutPrev) >= G.changeThreshold
  state.resources.guildCutPrev = actualCut
  const perceivedPct = Math.round(perceived * 100)
  const actualPct = Math.round(actualCut * 100)

  if (cutChanged) {
    for (const idol of state.idols) idol.morale = Math.max(-5, Math.min(100, idol.morale - G.changePenalty))
    logs.push({
      kind: 'bad',
      text: `分成临时调到了 ${actualPct}%。群里没有讨论这件事，只发了一个「收到」。`,
    })
  }

  /* 收入：平台先抽 50%，剩下的里面公会抽 guildCut，其余给主播 */
  const split = revenueSplit(totalFans, state.resources.reputation, state.resources.guildCut)
  const income = split.agency

  /* 支出：固定 + 随机运营波动 */
  const overrun = rng.chance(0.35) ? Math.round(opts.fixedCost * rng.range(0.04, 0.14)) : 0
  const cost = opts.fixedCost + overrun

  state.resources.money += income - cost

  const pct = (v: number) => `${Math.round(v * 100)}%`
  logs.push({
    kind: 'ledger',
    text: '月度流水对账',
    rows: [
      { label: '直播流水（粉丝打赏）', value: `¥${split.gross.toLocaleString()}`, tone: 'sub' },
      {
        label: `打赏边际（路人粉稀释）`,
        value: `×${split.dilution.toFixed(2)}`,
        tone: 'sub',
      },
      {
        label: `平台抽成 ${pct(CONFIG.revenue.platformCut)}`,
        value: `-¥${split.platform.toLocaleString()}`,
        tone: 'out',
      },
      { label: '平台结算后余', value: `¥${split.afterPlatform.toLocaleString()}`, tone: 'sub' },
      {
        label: `公会分成 ${pct(state.resources.guildCut)}`,
        value: `+¥${split.guild.toLocaleString()}`,
        tone: 'in',
      },
      { label: '主播分成', value: `¥${split.idols.toLocaleString()}`, tone: 'sub' },
      { label: '周边与外快（不被抽成）', value: `+¥${split.merch.toLocaleString()}`, tone: 'in' },
      ...(opts.scaleCost
        ? [
            { label: '底薪与运营', value: `-¥${(cost - overrun - opts.scaleCost).toLocaleString()}`, tone: 'out' as const },
            { label: '规模成本（棚 / 带宽 / 税）', value: `-¥${opts.scaleCost.toLocaleString()}`, tone: 'out' as const },
            ...(overrun
              ? [{ label: '本月超支', value: `-¥${overrun.toLocaleString()}`, tone: 'out' as const }]
              : []),
          ]
        : [
            {
              label: overrun ? `固定支出（含超支 ¥${overrun.toLocaleString()}）` : '固定支出',
              value: `-¥${cost.toLocaleString()}`,
              tone: 'out' as const,
            },
          ]),
      {
        label: `本月净${income - cost >= 0 ? '收入' : '亏损'}`,
        value: `${income - cost >= 0 ? '+' : '-'}¥${Math.abs(income - cost).toLocaleString()}`,
        tone: 'total',
      },
      {
        label: '成员感受到的分成',
        value: `感知 ${perceivedPct}% · 心态 ${guildCutMoraleDelta(perceived) >= 0 ? '+' : ''}${guildCutMoraleDelta(perceived).toFixed(1)}/月`,
        tone: 'sub',
      },
    ],
  })
  logs.push({
    kind: state.resources.money >= 0 ? 'result' : 'bad',
    text: `账面余额：¥${state.resources.money.toLocaleString()}`,
  })

  if (overrun) {
    const reasons = [
      '服务器扩容了一台，因为有个视频被人转到了首页。',
      '棚里的灯烧了两根。',
      '平台又调了一次结算规则，运营说“早就该涨了”。',
      '财务把上个月的发票补交了。',
    ]
    logs.push({ kind: 'narration', text: rng.pick(reasons) })
  }

  /* 口碑：自然回落 + 分成带来的恶评 */
  state.resources.reputation = Math.max(
    0,
    state.resources.reputation + guildCutReputationDelta(perceived) - CONFIG.morale.reputationDecay,
  )

  /* 成员状态 */
  const graduations: string[] = []
  const sick: string[] = []
  const warned: string[] = []

  // 本月粉丝增长（决定「被看见」带来的心态加成）
  const prevFans = state.history.length ? state.history[state.history.length - 1].fans : totalFans
  const growth = prevFans > 0 ? totalFans / prevFans - 1 : 0

  for (const idol of state.idols) {
    const def = IDOL_BY_ID.get(idol.id)!
    const fatBefore = idol.fatigue

    idol.fatigue = Math.max(0, idol.fatigue - BALANCE.dailyRecover)

    if (fatBefore >= BALANCE.fatigueSick) {
      sick.push(def.name)
      idol.fatigue = Math.max(20, idol.fatigue - 30)
      idol.morale -= 12
      state.counters['sickPenalty'] = (state.counters['sickPenalty'] ?? 0) + 1
    }

    // 心态模型：累的人会崩，休息好的人会缓过来，被看见的人会更开心，
    // 被抽得太狠的人会觉得企划在压榨她
    const M = CONFIG.morale
    let delta = 0
    for (const band of M.bands) {
      if (idol.fatigue < band.below) {
        delta = band.delta
        break
      }
    }
    if (growth > M.growthBonus.threshold) delta += M.growthBonus.value
    else if (growth < M.stagnation.threshold) delta += M.stagnation.value
    if (state.phase === 2) delta += M.phase2Penalty
    if (idol.morale < M.spiral.below) delta += M.spiral.value
    delta += guildCutMoraleDelta(perceived)
    // 心态越高越难继续涨（边际递减）
    if (delta > 0) delta *= Math.max(0, 1 - Math.max(0, idol.morale) / M.diminishingDivisor)
    const ceiling = guildCutMoraleCeiling(perceived)
    idol.morale = Math.max(-5, Math.min(ceiling, idol.morale + delta))

    // 低心态预警 / 毕业流程
    if (idol.morale <= 0) {
      if (idol.gradRisk < 0) {
        idol.gradRisk = CONFIG.graduation.riskMonths
        warned.push(def.name)
        logs.push({
          kind: 'bad',
          text: `${def.name} 在群里发了一句「ちょっと休みたい」，然后撤回了。你看见了。`,
          who: def.nick,
        })
        logs.push({
          kind: 'system',
          text: `毕业倒计时：${def.name}（${CONFIG.graduation.riskMonths} 个月）。在她崩掉之前，把心态拉回 ${CONFIG.graduation.resetAbove} 以上。`,
        })
      } else {
        idol.gradRisk -= 1
        if (idol.gradRisk <= 0) graduations.push(def.id)
      }
    } else if (idol.morale >= CONFIG.graduation.resetAbove && idol.gradRisk >= 0) {
      idol.gradRisk = -1
      logs.push({ kind: 'good', text: `${def.name} 撤回了那条消息。然后又发了一个表情包。` })
    } else if (idol.morale < CONFIG.graduation.resetAbove && idol.gradRisk < 0) {
      warned.push(def.name)
    }
  }

  const bankrupt = state.resources.money < 0

  if (bankrupt) {
    logs.push({ kind: 'bad', text: '账上没钱了。财务把最后一张报销单推到你面前，没有说话。' })
  } else if (state.resources.money < opts.fixedCost * 0.35) {
    logs.push({ kind: 'bad', text: `资金低于一个月固定支出。撑不到下个月就要出事。` })
  }

  return { logs, income, cost, split, bankrupt, graduations, sick, warned }
}

/** 给 UI 与日志共用的本月风向（含中文标签） */
export function monthTrendView(state: GameState): {
  hot: { id: string; name: string; mul: number }
  cold: { id: string; name: string; mul: number }
  hotLabel: string
  coldLabel: string
} {
  const trend = monthTrend(state.seed, state.month)
  const nameOfAction = (id: string) => ACTION_BY_ID.get(id)?.name ?? id
  return {
    hot: { id: trend.hot, name: nameOfAction(trend.hot), mul: trend.hotMul },
    cold: { id: trend.cold, name: nameOfAction(trend.cold), mul: trend.coldMul },
    hotLabel: trendConfig().hotLabel,
    coldLabel: trendConfig().coldLabel,
  }
}

/** 月度开场白 */
export function monthOpening(state: GameState, rng: Rng, monthLabel: string): LogLine[] {
  const total = state.idols.reduce((s, i) => s + i.fans, 0)
  const v = monthTrendView(state)
  const lines: LogLine[] = [
    { kind: 'system', text: `—— ${monthLabel} · 企划总粉丝 ${total.toLocaleString()} · 资金 ¥${state.resources.money.toLocaleString()} ——` },
  ]
  if (v.hot.id) {
    lines.push({
      kind: 'system',
      text: `【本月风向】${v.hotLabel}「${v.hot.name}」（×${v.hot.mul.toFixed(2)}），${v.coldLabel}「${v.cold.name}」（×${v.cold.mul.toFixed(2)}）。`,
    })
  }
  if (rng.chance(0.5)) lines.push({ kind: 'quote', text: rng.pick(MOUSE_QUOTES), who: '鼠标' })
  if (rng.chance(0.35)) lines.push({ kind: 'narration', text: rng.pick(FAN_QUOTES), who: '弹幕' })
  return lines
}

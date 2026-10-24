/**
 * 无界面平衡模拟器。
 * npx tsx scripts/sim.ts [局数]
 */
import { ACTIONS, ACTION_BY_ID, type ActionDef } from '../src/data/actions'
import { EVENTS } from '../src/data/events'
import { createInitialIdolState, IDOL_BY_ID } from '../src/data/idols'
import { evaluateLive } from '../src/data/endings'
import { BALANCE, CONFIG, fixedCostParts } from '../src/engine/balance'
import { Rng } from '../src/engine/rng'
import { monthTrend } from '../src/engine/trend'
import { applyActionResult, monthEnd, resolveAction, effectiveStat } from '../src/engine/resolve'
import type { EventContext, GameEvent, GameState } from '../src/engine/types'

const START = CONFIG.economy.startMoney

function createState(seed: number): GameState {
  return {
    phase: 1,
    month: 1,
    monthInPhase: 1,
    resources: {
      money: START,
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
    history: [{ month: 0, label: '开局', fans: 24600, money: START, reputation: 42 }],
    pending: [],
    ending: null,
    marketing: 1,
    buffs: { fanMul: 1, repBoost: 0, fatigueCut: 1 },
    nextFanMul: 1,
    merchLevel: 0,
    achievements: [],
    flags: {},
    counters: {},
    seed,
  }
}

const total = (s: GameState) => s.idols.reduce((a, i) => a + i.fans, 0)

function fixedParts(s: GameState) {
  const p = fixedCostParts(s.phase, total(s))
  const mul = s.flags['raised'] ? 1.2 : 1
  return { total: Math.round(p.total * mul), scale: Math.round(p.scale * mul) }
}

function fixed(s: GameState) {
  return fixedParts(s).total
}

function makeCtx(s: GameState, rng: Rng): EventContext {
  return {
    money: s.resources.money,
    fans: total(s),
    reputation: s.resources.reputation,
    idols: s.idols,
    pick: (ids) => ids.filter(Boolean),
    rand: () => rng.next(),
    state: s,
  }
}

interface PolicyResult {
  month: number
  outcome: 'alive24' | 'bankrupt' | 'graduated'
  fans: number
  money: number
  state: GameState
}

const NAIVE = process.argv[3] === 'naive'

/* 通过环境变量做参数扫描（仅在模拟器内生效，不改游戏代码） */
const envNum = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d)
const FAN_MUL = envNum('FAN_MUL', 1)
if (FAN_MUL !== 1) ACTIONS.forEach((a) => {
  if (a.base > 0) a.base = Math.round(a.base * FAN_MUL)
})
;(BALANCE.fixedCost as { salary: number }).salary = envNum('SALARY', BALANCE.fixedCost.salary)
;(BALANCE.fixedCost as { operation: number }).operation = envNum('OP', BALANCE.fixedCost.operation)
const FIXED_CUT = envNum('GUILD_CUT', 0) // >0 时固定抽成
{
  const rest = ACTION_BY_ID.get('rest')!
  const t = envNum('REST_T', rest.targets.max)
  rest.targets = { min: rest.targets.min, max: t }
  rest.fatigue = envNum('REST_F', rest.fatigue)
}

/** 新手策略：只做内容，不休息、不看心态、不恰饭 */
function choosePlanNaive(s: GameState, rng: Rng) {
  const plan: { def: ActionDef; targets: string[]; option?: string }[] = []
  let ap = s.resources.apMax
  let budget = s.resources.money
  const byStat = (k: 'vocal' | 'dance' | 'talk' | 'charm') =>
    [...s.idols].sort((a, b) => effectiveStat(b, k) - effectiveStat(a, k))
  let guard = 0
  while (ap > 0 && guard++ < 10) {
    const opts: { id: string; targets: string[] }[] = [
      { id: 'cover', targets: byStat('vocal').slice(0, 2).map((i) => i.id) },
      { id: 'dance', targets: byStat('dance').slice(0, 2).map((i) => i.id) },
      { id: 'variety', targets: byStat('charm').slice(0, 2).map((i) => i.id) },
      { id: 'group', targets: s.idols.slice(0, 3).map((i) => i.id) },
    ]
    const pick = rng.pick(opts)
    const def = ACTION_BY_ID.get(pick.id)!
    if (ap >= def.ap && budget >= def.money) {
      ap -= def.ap
      budget -= def.money
      plan.push({ def, targets: pick.targets })
    } else if (ap >= 2 && budget >= 8000) {
      plan.push({ def: ACTION_BY_ID.get('cover')!, targets: byStat('vocal').slice(0, 2).map((i) => i.id) })
      ap -= 2
      budget -= 8000
    } else break
  }
  return plan
}

/** 一个「还算会玩」的策略 */
function choosePlan(s: GameState, rng: Rng): { def: ActionDef; targets: string[]; option?: string }[] {
  if (NAIVE) return choosePlanNaive(s, rng)
  const plan: { def: ActionDef; targets: string[]; option?: string }[] = []
  let ap = s.resources.apMax
  let budget = s.resources.money - fixed(s) // 留出固定支出

  const push = (id: string, targets: string[], option?: string) => {
    const def = ACTION_BY_ID.get(id)!
    if (ap < def.ap || budget < def.money) return false
    ap -= def.ap
    budget -= def.money
    if (def.id === 'clip') s.marketing = 1.28
    plan.push({ def, targets, option })
    return true
  }

  // 1) 轮休：把需要休息的人分批放掉（每次 6 个）
  const needRest = [...s.idols]
    .filter((i) => i.fatigue > 46 || i.morale < 45)
    .sort((a, b) => b.fatigue + (60 - a.morale) - (a.fatigue + (60 - b.morale)) * -1)
  needRest.sort((a, b) => b.fatigue - a.fatigue)
  while (needRest.length && ap >= 1) {
    const batch = needRest.splice(0, 6).map((i) => i.id)
    if (!push('rest', batch)) break
  }

  // 3) 缺钱恰饭
  if (s.resources.money < fixed(s) * 1.6) {
    const best = [...s.idols].sort((a, b) => b.stats.charm - a.stats.charm).slice(0, 2)
    push('sponsor', best.map((i) => i.id))
  }

  // 4) 内容
  const byStat = (k: 'vocal' | 'dance' | 'talk' | 'charm') =>
    [...s.idols].sort((a, b) => effectiveStat(b, k) - effectiveStat(a, k))

  if (s.month <= 4 && s.resources.money > 150_000) {
    push('training', byStat('vocal').slice(0, 3).map((i) => i.id), 'vocal')
  }

  // 切片投放性价比极高（现在它是唯一能直接买流量的地方）
  if (budget > 10_000 && plan.length >= 1) push('clip', [])

  // 周边：回款慢但长期，钱够就开一批
  if (s.merchLevel < 2 && budget > 60_000) push('merch', [])

  // 原创 / 3D 投资
  if (s.month >= 6 && budget > 90_000 && !s.flags['firstOriginal']) {
    s.flags['firstOriginal'] = true
    push('original', byStat('vocal').slice(0, 2).map((i) => i.id))
  }

  if (s.phase === 2 && budget > 130_000) {
    const not3d = s.idols.filter((i) => !i.threeD)
    while (not3d.length && ap >= 2 && budget >= 70_000) {
      const pick = [...not3d].sort((a, b) => b.stats.charm - a.stats.charm)[0]
      if (!push('three_d', [pick.id])) break
      not3d.splice(not3d.indexOf(pick), 1)
    }
  }

  // 补满 AP
  let guard = 0
  while (ap > 0 && guard++ < 12) {
    const options: { id: string; targets: string[] }[] = [
      { id: 'cover', targets: byStat('vocal').slice(0, 2).map((i) => i.id) },
      { id: 'chat', targets: byStat('talk').slice(0, 1).map((i) => i.id) },
      { id: 'group', targets: s.idols.slice(0, 3).map((i) => i.id) },
      { id: 'dance', targets: byStat('dance').slice(0, 2).map((i) => i.id) },
      { id: 'variety', targets: byStat('charm').slice(0, 2).map((i) => i.id) },
      { id: 'offline', targets: s.idols.slice(0, 4).map((i) => i.id) },
    ]
    // 玩家能提前看到「本月风向」，所以先挑被推的那个
    const hot = monthTrend(s.seed, s.month).hot
    const hotPick = options.find((o) => o.id === hot)
    const pick = hotPick && rng.chance(0.6) ? hotPick : rng.pick(options)
    if (!push(pick.id, pick.targets)) {
      if (!push('chat', byStat('talk').slice(0, 1).map((i) => i.id))) break
    }
  }

  return plan
}

function runGame(seed: number): PolicyResult {
  const s = createState(seed)
  const rng = new Rng(seed)
  let outcome: PolicyResult['outcome'] = 'alive24'

  for (let m = 0; m < 24; m++) {
    // 抽成策略
    if (FIXED_CUT > 0) {
      s.resources.guildCut = FIXED_CUT
    } else if (NAIVE) {
      s.resources.guildCut = CONFIG.revenue.guildCutMax
    } else {
      const avgMorale = s.idols.reduce((a, i) => a + i.morale, 0) / s.idols.length
      const fix = fixed(s)
      if (s.resources.money < fix * 2.5) s.resources.guildCut = 0.46
      else if (avgMorale < 34) s.resources.guildCut = CONFIG.revenue.guildCutMin
      else if (avgMorale > 72 && s.resources.money < fix * 8) s.resources.guildCut = 0.38
      else s.resources.guildCut = CONFIG.revenue.guildCutDefault
    }

    // 编成
    const plan = choosePlan(s, rng)
    if (!plan.length) plan.push({ def: ACTION_BY_ID.get('rest')!, targets: [s.idols[0].id] })

    s.marketing = plan.some((p) => p.def.id === 'clip') ? 1.28 : 1
    s.counters = {}

    for (const p of plan) {
      const res = resolveAction(p.def, p.targets, s, rng, p.option)
      s.counters[p.def.id] = (s.counters[p.def.id] ?? 0) + 1
      applyActionResult(s, res)
    }

    const end = monthEnd(s, rng, { fixedCost: fixed(s), phase: s.phase, scaleCost: fixedParts(s).scale })
    s.resources.apMax = end.sick.length ? 4 : 5

    if (end.graduations.length) {
      outcome = 'graduated'
      const g = s.idols.find((i) => i.id === end.graduations[0])!
      const def = IDOL_BY_ID.get(g.id)!
      if (process.env.DEBUG) {
        console.log(
          `  [毕业] seed M${s.month} ${def.name} 心态=${g.morale.toFixed(1)} 疲劳=${g.fatigue.toFixed(1)} gradRisk=${g.gradRisk} 均心=${(s.idols.reduce((a, i) => a + i.morale, 0) / 8).toFixed(1)}`,
        )
      }
      break
    }
    if (end.bankrupt) {
      outcome = 'bankrupt'
      break
    }

    s.history.push({
      month: s.month,
      label: '',
      fans: total(s),
      money: s.resources.money,
      reputation: s.resources.reputation,
    })

    // 事件：随机挑一个可用的，选第一个选项（乐观）
    if (rng.chance(CONFIG.events.chancePerMonth)) {
      const ctx = makeCtx(s, rng)
      const pool = EVENTS.filter((e) => e.id !== 'graduation_talk' && e.when(ctx))
      if (pool.length) {
        const ev: GameEvent = rng.pick(pool)
        const all = ev.choices(ctx)
        // 「还算会玩」的玩家不会主动选让成员毕业的选项
        const safe = all.filter((c) => !/签字|放她走/.test(c.label))
        const choices = safe.length ? safe : all
        const idx =
          ev.id === 'graduation_talk'
            ? 0
            : Math.min(choices.length - 1, Math.floor(rng.next() * choices.length))
        const out = choices[idx].apply(ctx)
        if (out.money) s.resources.money += out.money
        if (out.reputation) s.resources.reputation = Math.max(0, Math.min(100, s.resources.reputation + out.reputation))
        if (out.fans) {
          const t = total(s) || 1
          s.idols.forEach((i) => (i.fans = Math.max(0, i.fans + Math.round((out.fans! * i.fans) / t))))
        }
        if (out.morale) {
          const ids = out.morale.all ? s.idols.map((i) => i.id) : out.morale.ids ?? []
          ids.forEach((id) => {
            const i = s.idols.find((x) => x.id === id)
            if (i) i.morale = Math.max(-5, Math.min(100, i.morale + out.morale!.delta))
          })
        }
        if (out.fatigue) {
          const ids = out.fatigue.all ? s.idols.map((i) => i.id) : out.fatigue.ids ?? []
          ids.forEach((id) => {
            const i = s.idols.find((x) => x.id === id)
            if (i) i.fatigue = Math.max(0, Math.min(130, i.fatigue + out.fatigue!.delta))
          })
        }
        if (out.graduate && out.graduate.length) {
          outcome = 'graduated'
          break
        }
      }
    }

    // 推进
    const finishedPhase = s.monthInPhase === 12
    const wasPhase = s.phase
    s.month += 1
    s.monthInPhase = s.monthInPhase === 12 ? 1 : s.monthInPhase + 1
    s.marketing = 1
    s.buffs = { fanMul: s.nextFanMul, repBoost: 0, fatigueCut: 1 }
    s.nextFanMul = 1
    s.counters = {}
    s.resources.ap = s.resources.apMax
    if (finishedPhase && wasPhase === 1) s.phase = 2
    if (finishedPhase && wasPhase === 2) break
  }

  return { month: s.month, outcome, fans: total(s), money: s.resources.money, state: s }
}

const N = Number(process.argv[2] ?? 400)
const results: PolicyResult[] = []
for (let i = 0; i < N; i++) results.push(runGame(1000 + i * 7919))

const count = (o: PolicyResult['outcome']) => results.filter((r) => r.outcome === o).length
const alive = results.filter((r) => r.outcome === 'alive24')
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)

console.log(`\n=== ${N} 局（策略：还算会玩） ===`)
console.log(`撑到 24 个月 : ${count('alive24')} (${((count('alive24') / N) * 100).toFixed(1)}%)`)
console.log(`破产         : ${count('bankrupt')} (${((count('bankrupt') / N) * 100).toFixed(1)}%)`)
console.log(`成员毕业     : ${count('graduated')} (${((count('graduated') / N) * 100).toFixed(1)}%)`)
console.log(`平均结束月份 : ${avg(results.map((r) => r.month)).toFixed(1)}`)
if (alive.length) {
  console.log(`通关平均粉丝 : ${Math.round(avg(alive.map((r) => r.fans))).toLocaleString()}`)
  console.log(`通关平均资金 : ¥${Math.round(avg(alive.map((r) => r.money))).toLocaleString()}`)
  console.log(`通关粉丝区间 : ${Math.min(...alive.map((r) => r.fans)).toLocaleString()} ~ ${Math.max(...alive.map((r) => r.fans)).toLocaleString()}`)
  console.log(`平均 3D 数  : ${(alive.reduce((a, r) => a + r.state.idols.filter((i) => i.threeD).length, 0) / alive.length).toFixed(1)} / 8`)
}
// Live 评级分布（按真实最终状态 + 线上制作费是否付得起）
const gradeDist: Record<string, number> = {}
const scoreList: number[] = []
for (const r of alive) {
  if (r.state.resources.money >= CONFIG.live.venueCost) r.state.flags['grandVenue'] = true
  const g = evaluateLive(r.state)
  gradeDist[g.tierLabel] = (gradeDist[g.tierLabel] ?? 0) + 1
  scoreList.push(g.score)
}
console.log('\nLive 评级分布（真实最终状态）：')
Object.entries(gradeDist)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k.padEnd(10)} ${String(v).padStart(3)} (${((v / alive.length) * 100).toFixed(0)}%)`))
console.log(`  平均 Live 评分 ${(scoreList.reduce((a, b) => a + b, 0) / Math.max(1, scoreList.length)).toFixed(1)}`)

const busted = results.filter((r) => r.outcome !== 'alive24')
if (busted.length) {
  console.log(`失败平均月份 : ${avg(busted.map((r) => r.month)).toFixed(1)}`)
}

/* ------------------------------------------------------------------ */
/* 随机性体检                                                          */
/* ------------------------------------------------------------------ */

/**
 * 同一个行动、同一个人在同样的状态下重复掷 3000 次。
 * 如果分位数挤成一条线、或者爆款/翻车率对不上配置，说明随机模型又「写死」了。
 */
function luckReport() {
  const probe = createState(20260101)
  probe.idols.forEach((i) => {
    i.fans = 30000 / probe.idols.length
    i.morale = 70
    i.fatigue = 15
  })
  const rng = new Rng(987654321)

  console.log('\n--- 随机性体检（同一行动 × 3000 次） ---')
  console.log('   行动       P5     P25    中位    P75     P95     爆款   翻车')
  for (const id of ['chat', 'cover', 'dance', 'variety', 'group', 'original']) {
    const def = ACTION_BY_ID.get(id)!
    const pool = [...probe.idols].sort((a, b) => b.stats[def.stat] - a.stats[def.stat])
    const targets = pool.slice(0, Math.max(1, Math.min(def.targets.max, 2))).map((i) => i.id)
    const vals: number[] = []
    let surge = 0
    let flop = 0
    for (let i = 0; i < 3000; i++) {
      probe.marketing = 1
      probe.buffs = { fanMul: 1, repBoost: 0, fatigueCut: 1 }
      probe.resources.guildCutPerceived = CONFIG.revenue.guildCutDefault
      const before = probe.idols.map((x) => ({ fans: x.fans, fatigue: x.fatigue, morale: x.morale }))
      const res = resolveAction(def, targets, probe, rng)
      vals.push(res.fanDelta)
      if (res.luck?.extreme === 'surge') surge++
      if (res.luck?.extreme === 'flop') flop++
      // 体检不推进状态，掷完就回滚
      probe.idols.forEach((x, idx) => {
        x.fans = before[idx].fans
        x.fatigue = before[idx].fatigue
        x.morale = before[idx].morale
      })
    }
    vals.sort((a, b) => a - b)
    const q = (p: number) => Math.round(vals[Math.min(vals.length - 1, Math.floor(p * vals.length))])
    console.log(
      `   ${def.name.padEnd(6)} ${String(q(0.05)).padStart(6)} ${String(q(0.25)).padStart(7)} ${String(q(0.5)).padStart(7)} ${String(q(0.75)).padStart(7)} ${String(q(0.95)).padStart(7)} ${(surge / 30).toFixed(1).padStart(5)}% ${(flop / 30).toFixed(1).padStart(5)}%`,
    )
  }
}

luckReport()

// 样例曲线
function trace(seed: number) {
  const s = createState(seed)
  const rng = new Rng(seed)
  const rows: string[] = []
  for (let m = 0; m < 24; m++) {
    if (FIXED_CUT > 0) s.resources.guildCut = FIXED_CUT
    const plan = choosePlan(s, rng)
    if (!plan.length) plan.push({ def: ACTION_BY_ID.get('rest')!, targets: [s.idols[0].id] })
    s.marketing = plan.some((p) => p.def.id === 'clip') ? 1.28 : 1
    s.counters = {}
    for (const p of plan) {
      const res = resolveAction(p.def, p.targets, s, rng, p.option)
      s.counters[p.def.id] = (s.counters[p.def.id] ?? 0) + 1
      applyActionResult(s, res)
    }
    const end = monthEnd(s, rng, { fixedCost: fixed(s), phase: s.phase, scaleCost: fixedParts(s).scale })
    s.resources.apMax = end.sick.length ? 4 : 5
    rows.push(
      `M${String(s.month).padStart(2)} [${plan.map((p) => p.def.id + ':' + p.targets.length).join(',')}] ${s.phase === 1 ? 'P1' : 'P2'} 粉 ${String(total(s)).padStart(7)}  钱 ${String(s.resources.money).padStart(8)}  口碑 ${s.resources.reputation.toFixed(0).padStart(3)}  均心 ${Math.round(s.idols.reduce((a, i) => a + i.morale, 0) / 8).toString().padStart(3)}  均疲 ${Math.round(s.idols.reduce((a, i) => a + i.fatigue, 0) / 8).toString().padStart(3)}  抽${(s.resources.guildCut * 100).toFixed(0)}%  3D ${s.idols.filter((i) => i.threeD).length} 晶(心${s.idols.find((i) => i.id === 'akira')!.morale.toFixed(0)},疲${s.idols.find((i) => i.id === 'akira')!.fatigue.toFixed(0)})  ${end.bankrupt ? '破产' : ''}${end.graduations.length ? '毕业' : ''}`,
    )
    if (end.bankrupt || end.graduations.length) break
    const finishedPhase = s.monthInPhase === 12
    const wasPhase2 = s.phase
    s.month += 1
    s.monthInPhase = s.monthInPhase === 12 ? 1 : s.monthInPhase + 1
    s.marketing = 1
    s.buffs = { fanMul: s.nextFanMul, repBoost: 0, fatigueCut: 1 }
    s.nextFanMul = 1
    s.counters = {}
    s.resources.ap = s.resources.apMax
    if (finishedPhase && wasPhase2 === 1) s.phase = 2
    if (finishedPhase && wasPhase2 === 2) break
  }
  return rows
}
console.log('\n--- 样例曲线 (seed 424242) ---')
console.log(trace(424242).join('\n'))

// 找一个毕业的局看看
for (let i = 0; i < 4000; i++) {
  const seed = 5000 + i * 131
  if (runGame(seed).outcome === 'graduated') {
    console.log(`\n--- 毕业局曲线 (seed ${seed}) ---`)
    console.log(trace(seed).join('\n'))
    break
  }
}

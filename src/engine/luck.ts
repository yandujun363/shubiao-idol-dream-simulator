import { CONFIG } from './balance'
import type { Rng } from './rng'
import type { Tier } from '../data/narration'
import type { LuckRoll } from './types'

/**
 * 行动发挥的随机模型。
 *
 * 之前每个行动只有一个 `[min, max]` 的均匀浮动，八个行动跑下来每月的数字
 * 都挤在期望值 ±30% 内，看起来就像「写死的」。
 *
 * 现在的模型分三层：
 *   1. 主体：对数正态（中位数 1）。大部分月份贴着期望值走，偶尔偏一点。
 *   2. 尾巴：小概率的爆款 / 翻车，倍率直接拉到 2~3 倍或砍到三成。
 *   3. 分档：最终倍率落进哪个区间决定叙事走哪一档，所以「文案」和「数字」永远一致。
 *
 * 尾部倍率与概率全部在 config.json 里，行动可以单独覆盖（`actions.json` 的 `luck`）。
 */
export interface LuckSpec {
  bodySigma: number
  flopChance: number
  flop: [number, number]
  surgeChance: number
  surge: [number, number]
}

export const TIER_LABEL: Record<Tier, string> = {
  crit: '超常发挥',
  good: '发挥不错',
  ok: '正常发挥',
  bad: '发挥失常',
}

const SURGE_LABEL = '爆款'
const FLOP_LABEL = '翻车'

interface LuckConfig {
  bodySigma: number
  flopChance: number
  flop: [number, number]
  surgeChance: number
  surge: [number, number]
  bodyClamp: [number, number]
  tiers: { crit: number; good: number; ok: number }
}

export function luckConfig(): LuckConfig {
  return CONFIG.luck as unknown as LuckConfig
}

/** 行动自己的 luck 覆盖全局默认值 */
export function luckSpec(patch?: Partial<LuckSpec>): LuckSpec {
  const c = luckConfig()
  return {
    bodySigma: patch?.bodySigma ?? c.bodySigma,
    flopChance: patch?.flopChance ?? c.flopChance,
    flop: patch?.flop ?? c.flop,
    surgeChance: patch?.surgeChance ?? c.surgeChance,
    surge: patch?.surge ?? c.surge,
  }
}

/** Box-Muller，用同一个种子随机源，保证同一存档可复现 */
function gauss(rng: Rng): number {
  const u = Math.max(1e-9, rng.next())
  const v = rng.next()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function tierOf(mul: number): Tier {
  const t = luckConfig().tiers
  if (mul >= t.crit) return 'crit'
  if (mul >= t.good) return 'good'
  if (mul >= t.ok) return 'ok'
  return 'bad'
}

export function rollLuck(rng: Rng, patch?: Partial<LuckSpec>): LuckRoll {
  const spec = luckSpec(patch)
  const r = rng.next()

  if (r < spec.flopChance) {
    const mul = rng.range(spec.flop[0], spec.flop[1])
    return { mul, tier: 'bad', label: FLOP_LABEL, extreme: 'flop' }
  }
  if (r < spec.flopChance + spec.surgeChance) {
    const mul = rng.range(spec.surge[0], spec.surge[1])
    return { mul, tier: 'crit', label: SURGE_LABEL, extreme: 'surge' }
  }

  // 除以 exp(σ²/2) 让主体的期望值保持 1，预估值才不会被随机模型带偏
  const c = luckConfig()
  const raw = Math.exp(spec.bodySigma * gauss(rng)) / Math.exp((spec.bodySigma * spec.bodySigma) / 2)
  const mul = Math.max(c.bodyClamp[0], Math.min(c.bodyClamp[1], raw))
  const tier = tierOf(mul)
  return { mul, tier, label: TIER_LABEL[tier], extreme: null }
}

/** 预览用的上下界：不考虑具体这次掷出什么，只给出这个行动的浮动范围 */
export function luckBounds(patch?: Partial<LuckSpec>): { low: number; high: number } {
  const spec = luckSpec(patch)
  return { low: spec.flop[0], high: Math.max(1.2, spec.surge[1]) }
}

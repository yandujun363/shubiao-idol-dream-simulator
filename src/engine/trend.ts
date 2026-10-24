import { CONFIG } from './balance'
import { hashSeed } from './rng'

/**
 * 平台风向：每个月有一类内容被算法推，另一类被压。
 *
 * 这个波动不是「再加一层随机」——它每个月固定、且玩家能提前看到，
 * 所以它是信息而不是噪音：有的月份该多做翻唱，有的月份该去整活。
 * 用 seed + 月份派生，不写进存档，读档、重开都稳定。
 */
export interface MonthTrend {
  hot: string
  cold: string
  hotMul: number
  coldMul: number
}

interface TrendConfig {
  hotMul: number
  coldMul: number
  pool: string[]
  hotLabel: string
  coldLabel: string
}

export function trendConfig(): TrendConfig {
  return CONFIG.trend as TrendConfig
}

export function monthTrend(seed: number, month: number): MonthTrend {
  const c = trendConfig()
  const pool = c.pool
  if (pool.length < 2) return { hot: '', cold: '', hotMul: 1, coldMul: 1 }
  const hot = pool[hashSeed(`${seed}:${month}:hot`) % pool.length]
  let cold = pool[hashSeed(`${seed}:${month}:cold`) % pool.length]
  if (cold === hot) cold = pool[(pool.indexOf(hot) + 1) % pool.length]
  return { hot, cold, hotMul: c.hotMul, coldMul: c.coldMul }
}

/** 这个行动在本月风向里吃到多少倍率（没吃到就是 1） */
export function trendMulOf(trend: MonthTrend, actionId: string): number {
  if (actionId === trend.hot) return trend.hotMul
  if (actionId === trend.cold) return trend.coldMul
  return 1
}

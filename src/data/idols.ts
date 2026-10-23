import raw from './idols.json'
import type { IdolDef, IdolState } from '../engine/types'
import { CONFIG } from '../engine/balance'

/**
 * 八位成员。数值全部在 `src/data/idols.json`。
 *
 * 名字统一是「中文前缀 + 英文后缀」；`id` 是存档主键，改名字时不要动它。
 * 光芒系：日光 / 月光 / 星光
 * 宝石系：水红玛瑙 / 蜜蜡石 / 翡翠 / 青金石 / 紫水晶
 */
export const IDOLS = raw as unknown as IdolDef[]

export const IDOL_BY_ID = new Map(IDOLS.map((i) => [i.id, i]))

export const START_MONEY = CONFIG.economy.startMoney

export function createInitialIdolState(): IdolState[] {
  return IDOLS.map((def) => ({
    id: def.id,
    stats: { ...def.base },
    fans: def.fans,
    morale: def.morale,
    fatigue: 12,
    threeD: false,
    used: 0,
    gradRisk: -1,
    contributed: 0,
  }))
}

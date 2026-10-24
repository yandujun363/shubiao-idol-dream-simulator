import raw from './actions.json'
import type { LineKey, StatKey } from '../engine/types'
import type { LuckSpec } from '../engine/luck'

/**
 * 行动表。数值全部在 `src/data/actions.json`。
 * 这里的接口只描述结构，结算逻辑在 `src/engine/resolve.ts`。
 */
export type ActionTag = 'daily' | 'content' | 'marketing' | 'invest' | 'rest'

export interface ActionDef {
  id: string
  name: string
  tag: ActionTag
  ap: number
  money: number
  /** 一句话说明 */
  desc: string
  /** 鼠标的评价（吐槽） */
  quip: string
  targets: { min: number; max: number; line?: LineKey | 'any'; need3D?: boolean }
  stat: StatKey
  /** 基础涨粉 */
  base: number
  fatigue: number
  morale: number
  grow: Partial<Record<StatKey, number>>
  rep: number
  /** 发挥的随机分布（覆盖 config.luck 的默认值） */
  luck?: Partial<LuckSpec>
  /** 每个成员只能做一次 */
  oncePerMember?: boolean
  /** 切片投放：本月全部涨粉倍率 */
  boost?: number
  /** 数据复盘：下月全部涨粉倍率 */
  reviewBoost?: number
  /** 商务恰饭：每粉丝收入系数 */
  sponsorRate?: number
  /** 商务恰饭：同月叠加递减 */
  sponsorFade?: number
}

export const ACTIONS = raw as unknown as ActionDef[]

export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]))

export const TAG_LABEL: Record<ActionTag, string> = {
  daily: '日常',
  content: '内容',
  marketing: '营销',
  invest: '投资',
  rest: '休整',
}

export const STAT_BY_ACTION: Record<string, StatKey> = Object.fromEntries(
  ACTIONS.map((a) => [a.id, a.stat]),
)

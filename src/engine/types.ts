/** 核心类型定义 */

export type LineKey = 'light' | 'gem'

export type StatKey = 'vocal' | 'dance' | 'talk' | 'charm'

export const STAT_LABELS: Record<StatKey, string> = {
  vocal: '唱力',
  dance: '舞力',
  talk: '杂谈',
  charm: '表现',
}

export type StatBlock = Record<StatKey, number>

/** 一次行动的发挥结果（随机模型的产物） */
export interface LuckRoll {
  /** 最终作用在涨粉上的倍率 */
  mul: number
  /** 叙事档位 */
  tier: 'crit' | 'good' | 'ok' | 'bad'
  /** 给结果行用的一句话 */
  label: string
  /** 是否极端结果（爆款 / 翻车） */
  extreme: 'surge' | 'flop' | null
}

export interface IdolDef {
  id: string
  /** 汉字名 */
  name: string
  /** 罗马音（看起来像英文） */
  romaji: string
  /** 粉丝称呼 */
  nick: string
  /** 原型 */
  prototype: string
  line: LineKey
  /** 主题色 */
  color: string
  color2: string
  /** 印章字 */
  seal: string
  /** 人设标签 */
  traits: string[]
  /** 一句话人设 */
  bio: string
  /** 造型编号，0-7 */
  look: number
  /** 底色色相偏移 */
  hue: number
  base: StatBlock
  /** 开局粉丝 */
  fans: number
  /** 初始心态 */
  morale: number
  /** 口癖 / 代表台词 */
  voice: string
}

export interface IdolState {
  id: string
  stats: StatBlock
  fans: number
  morale: number
  fatigue: number
  /** 是否已 3D 化 */
  threeD: boolean
  /** 本月已参与的行动次数（用于疲劳/饱和） */
  used: number
  /** 毕业倒计时（<0 = 没在毕业流程） */
  gradRisk: number
  /** 累计贡献粉丝 */
  contributed: number
}

export interface Resources {
  money: number
  /** 口碑 */
  reputation: number
  /** 本季度已用行动点 */
  ap: number
  apMax: number
  /** 公会抽成率（平台抽完后，公会在剩余部分里的抽成） */
  guildCut: number
  /** 成员主观感受到的抽成（慢慢跟随实际值） */
  guildCutPerceived: number
  /** 上个月实际执行的抽成，用来判断「临时改分成」 */
  guildCutPrev: number
}

export interface GameState {
  phase: 1 | 2
  /** 从 1 开始的游戏月 */
  month: number
  /** 1..12 per phase */
  monthInPhase: number
  resources: Resources
  idols: IdolState[]
  /** 无限流：HE 之后的纯数据模式 */
  endless: boolean
  endlessMonth: number
  /** 已触发的事件 id */
  seenEvents: string[]
  /** 上月的粉丝总量，用于算增长曲线 */
  history: HistoryPoint[]
  /** 本月已选行动 */
  pending: PendingAction[]
  /** 结束状态 */
  ending: EndingResult | null
  /** 本月已消耗的营销倍率（切片投放等） */
  marketing: number
  /** 本月生效的加成 */
  buffs: Buffs
  /** 数据复盘攒下的「下月涨粉倍率」，月末滚存到 buffs.fanMul */
  nextFanMul: number
  /** 触发过的成就 */
  achievements: string[]
  /** 剧情旗标 */
  flags: Record<string, boolean>
  /** 本月计数器（同一行动次数等） */
  counters: Record<string, number>
  /** 随机种子 */
  seed: number
}

export interface Buffs {
  /** 下月全部涨粉倍率 */
  fanMul: number
  /** 下月口碑加成 */
  repBoost: number
  /** 下月疲劳减免 */
  fatigueCut: number
}

export interface HistoryPoint {
  month: number
  label: string
  fans: number
  money: number
  reputation: number
}

export interface PendingAction {
  uid: string
  actionId: string
  /** 参与的成员 id */
  targets: string[]
  /** 子选项（选曲、主题等） */
  option?: string
}

export interface ActionResult {
  logs: LogLine[]
  fanDelta: number
  moneyDelta: number
  repDelta: number
  /** 通用内容行动的发挥结果；特殊行动没有 */
  luck?: LuckRoll
  idolDeltas: {
    id: string
    stats?: Partial<StatBlock>
    fans?: number
    morale?: number
    fatigue?: number
    threeD?: boolean
  }[]
}

export type LogKind =
  | 'narration'
  | 'action'
  | 'result'
  | 'system'
  | 'event'
  | 'good'
  | 'bad'
  | 'quote'
  | 'ledger'

export interface LogRow {
  label: string
  value: string
  /** in = 进账，out = 支出，sub = 中间项，total = 合计 */
  tone?: 'in' | 'out' | 'sub' | 'total'
}

export interface LogLine {
  kind: LogKind
  text: string
  /** 说话人 / 标签 */
  who?: string
  color?: string
  /** ledger 类型的表格行 */
  rows?: LogRow[]
}

export interface EndingResult {
  id: string
  type: 'HE' | 'BE'
  title: string
  subtitle: string
  body: string[]
  /** 结局统计 */
  epilogue: { label: string; value: string }[]
  /** 成员结局（可选） */
  cast?: {
    id: string
    name: string
    prototype: string
    fans: string
    morale: string
    threeD: boolean
    note: string
  }[]
  /** 结局曲目 */
  music: 'epic' | 'sad' | 'dream'
}

export interface EventChoice {
  label: string
  hint?: string
  /** 需要花的钱 */
  cost?: number
  apply: (ctx: EventContext) => EventOutcome
}

export interface EventContext {
  money: number
  fans: number
  reputation: number
  idols: IdolState[]
  pick: (ids: IdolState[]) => IdolState[]
  rand: () => number
  state: GameState
}

export interface EventOutcome {
  logs: LogLine[]
  money?: number
  fans?: number
  reputation?: number
  morale?: { ids?: string[]; delta: number; all?: boolean }
  fatigue?: { ids?: string[]; delta: number; all?: boolean }
  stat?: { ids?: string[]; key: StatKey; delta: number }
  flags?: Record<string, boolean>
  /** 强制触发毕业（直接进入 BE） */
  graduate?: string[]
}

export interface GameEvent {
  id: string
  title: string
  /** 触发条件 */
  when: (ctx: EventContext) => boolean
  /** 事件正文 */
  body: (ctx: EventContext) => LogLine[]
  choices: (ctx: EventContext) => EventChoice[]
  /** 是否可重复 */
  repeatable?: boolean
  /** 权重 */
  weight?: number
}

import raw from '../data/config.json'

/**
 * 全局数值配置。
 * 所有可调数字都在 `src/data/config.json` 里，这个文件只负责读取和派生。
 */
export const CONFIG = raw

/** 常用数值的快捷访问表 */
export const BALANCE = {
  startMoney: CONFIG.economy.startMoney,
  fixedCost: {
    salary: CONFIG.economy.salaryPerIdol,
    operation: CONFIG.economy.operationBase,
  },
  fanScale: CONFIG.fanGrowth.fansScale,
  fatigueMax: CONFIG.fatigue.max,
  fatigueSick: CONFIG.fatigue.sickAt,
  dailyRecover: CONFIG.fatigue.monthlyRecover,
  graduationAt: 0,
  moraleWarn: CONFIG.graduation.warnBelow,
  phase2CostMul: CONFIG.economy.phase2CostMul,
}

export interface FixedCostParts {
  /** 8 人底薪 + 运营（含阶段系数） */
  base: number
  /** 规模成本：粉丝涨上来之后多出来的那部分 */
  scale: number
  total: number
}

/**
 * 每月固定支出 =（8 人底薪 + 运营）× 阶段系数 + 规模成本。
 *
 * 规模成本是超线性的一部分：粉丝涨起来之后，棚、带宽、法务、税、还有「总得有人
 * 接商务」的运营团队都会跟着涨。没有它，收入随粉丝线性涨、成本却钉死，
 * 后期账上必然堆出一笔没处花的钱。
 */
export function fixedCostParts(phase: 1 | 2, totalFans = 0): FixedCostParts {
  const base = Math.round(
    (BALANCE.fixedCost.salary * 8 + BALANCE.fixedCost.operation) * (phase === 2 ? BALANCE.phase2CostMul : 1),
  )
  const s = CONFIG.economy.scaleCost
  const scale = Math.round(Math.max(0, totalFans - s.freeFans) * s.perFan)
  return { base, scale, total: base + scale }
}

export function monthlyFixedCost(phase: 1 | 2, totalFans = 0): number {
  return fixedCostParts(phase, totalFans).total
}

export function fanScale(totalFans: number): number {
  return Math.sqrt(1 + Math.max(0, totalFans) / BALANCE.fanScale)
}

/* ------------------------------------------------------------------ */
/* 收入模型                                                            */
/* ------------------------------------------------------------------ */

export interface RevenueSplit {
  /** 直播流水总额（粉丝打赏） */
  gross: number
  /** 平台先抽走的部分 */
  platform: number
  /** 平台抽完剩下的 */
  afterPlatform: number
  /** 公会从剩下的里面抽到的 */
  guild: number
  /** 主播拿到的 */
  idols: number
  /** 周边与外快（不被抽成，全部归公会） */
  merch: number
  /** 公会本月总进账 */
  agency: number
  /** 口碑倍率 */
  repMul: number
  /** 打赏边际：粉丝越多，单个粉丝的月均打赏越低（路人粉不付费） */
  dilution: number
}

/**
 * 打赏边际稀释。
 * 核心粉会一直打赏，路人粉不会——所以粉丝涨到后面，同样的「每人每月打赏额」撑不住。
 * 用一条双曲曲线压平后期收入，同时几乎不影响前期（2 万粉时仍有九成多）。
 */
export function fanDilution(fans: number): number {
  const d = CONFIG.revenue.dilution
  return d.floor + ((1 - d.floor) * d.halfFans) / (d.halfFans + Math.max(0, fans))
}

/**
 * 一个月的收入拆解。
 * 平台先抽 platformCut，剩下的里面公会抽 guildCut，其余给主播。
 * 周边不受抽成影响，但有上限（很难赚多）。
 */
export function revenueSplit(fans: number, reputation: number, guildCut: number): RevenueSplit {
  const repMul = CONFIG.revenue.repBase + reputation / CONFIG.revenue.repDiv
  const dilution = fanDilution(fans)
  const gross = Math.round(fans * CONFIG.revenue.grossPerFan * repMul * dilution)
  const platform = Math.round(gross * CONFIG.revenue.platformCut)
  const afterPlatform = gross - platform
  const guild = Math.round(afterPlatform * guildCut)
  const idols = afterPlatform - guild
  const merch = Math.round(
    Math.min(CONFIG.revenue.merchCap, fans * CONFIG.revenue.merchPerFan * repMul),
  )
  return { gross, platform, afterPlatform, guild, idols, merch, agency: guild + merch, repMul, dilution }
}

/**
 * 公会抽成对心态的每月影响（抽得多 = 被觉得压榨）。
 * 非对称：高于公平线扣得很凶，低于公平线只是小幅缓和。
 */
export function guildCutMoraleDelta(cut: number): number {
  const g = CONFIG.revenue.guildCut
  return cut > g.fair ? -(cut - g.fair) * g.aboveSensitivity : (g.fair - cut) * g.belowSensitivity
}

/**
 * 分成对内容产出的影响：被抽得太狠，主播就不愿意多干了。
 * 这是高抽成最直接的长期代价——涨粉变慢。
 */
export function guildCutGrowthMul(cut: number): number {
  const g = CONFIG.revenue.guildCut
  if (cut <= g.fair) return 1
  return Math.max(0.5, 1 - (cut - g.fair) * g.growthPenalty)
}

/** 分成对口碑的影响：抽得太狠，粉丝会替主播鸣不平 */
export function guildCutReputationDelta(cut: number): number {
  const g = CONFIG.revenue.guildCut
  return cut > g.fair ? -(cut - g.fair) * g.reputationPenalty : 0
}

/**
 * 分成带来的「心态天花板」。
 * 抽得太狠时，放再多假也开心不起来——这是压榨的长期代价。
 */
export function guildCutMoraleCeiling(cut: number): number {
  const g = CONFIG.revenue.guildCut
  if (cut > g.fair) return Math.max(5, 100 - (cut - g.fair) * g.aboveCapSensitivity)
  return Math.min(100, 100 + (g.fair - cut) * g.belowCapSensitivity)
}

/** 单个主播本月到手（底薪 + 流水分成按粉丝占比） */
export function idolTakeHome(fans: number, totalFans: number, idolsPool: number, salary: number): number {
  if (totalFans <= 0) return salary
  return Math.round(salary + (idolsPool * fans) / totalFans)
}

/* ------------------------------------------------------------------ */
/* 格式化                                                              */
/* ------------------------------------------------------------------ */

export function fmtMoney(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 100_000_000) return (n / 100_000_000).toFixed(2) + '亿'
  if (abs >= 10_000) return (n / 10_000).toFixed(abs >= 100_000 ? 1 : 2) + '万'
  return n.toLocaleString('zh-CN')
}

export function fmtNum(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 100_000_000) return (n / 100_000_000).toFixed(2) + '亿'
  if (abs >= 10_000) return (n / 10_000).toFixed(abs >= 100_000 ? 1 : 2) + '万'
  return Math.round(n).toLocaleString('zh-CN')
}

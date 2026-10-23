/** 确定性随机数：同一存档 seed 复现同一局 */

export class Rng {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9
  }

  /** 0..1 */
  next(): number {
    let t = (this.s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length]
  }

  pickMany<T>(arr: readonly T[], n: number): T[] {
    const pool = [...arr]
    const out: T[] = []
    while (pool.length && out.length < n) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0])
    }
    return out
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
}

let uidCounter = 0

export function uid(prefix = 'u'): string {
  uidCounter += 1
  return `${prefix}${uidCounter}`
}

/** 由字符串生成稳定种子 */
export function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

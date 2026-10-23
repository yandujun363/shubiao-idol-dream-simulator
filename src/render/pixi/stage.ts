import { Container, Graphics, Sprite } from 'pixi.js'
import { fadeBar, lightCone, lightStick, softCircle, spark, verticalGradient } from './textures'
import { VENUE } from './palette'

export interface StageConfig {
  fans: number
  colors: string[]
  threeD: number
  intensity: number
}

const hexNum = (hex: string) => parseInt(hex.replace('#', ''), 16)

interface Stick {
  s: Sprite
  x: number
  y: number
  phase: number
  speed: number
  h: number
}

interface Particle {
  s: Sprite
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
}

interface IdolNode {
  root: Container
  glow: Sprite
  body: Graphics
  head: Graphics
  halo: Graphics
  baseY: number
  phase: number
  has3D: boolean
}

/** 线上演唱会的虚拟舞台。全部由 Pixi 合成：贴图 -> 混合 -> 动画。 */
export class StageScene {
  readonly view = new Container()
  private bg = new Sprite()
  private screenG = new Graphics()
  private bandLayer = new Container()
  private coneLayer = new Container()
  private stageG = new Graphics()
  private idolLayer = new Container()
  private crowdLayer = new Container()
  private particleLayer = new Container()

  private bands: { s: Sprite; speed: number }[] = []
  private cones: Sprite[] = []
  private sticks: Stick[] = []
  private particles: Particle[] = []
  private idols: IdolNode[] = []

  private w = 1
  private h = 1
  private t = 0
  private cfg: StageConfig = { fans: 0, colors: [], threeD: 0, intensity: 0.25 }
  private built = false

  constructor() {
    this.view.addChild(this.bg, this.screenG, this.bandLayer, this.coneLayer)
    this.view.addChild(this.stageG, this.idolLayer, this.crowdLayer, this.particleLayer)
    this.view.visible = false
    this.view.alpha = 0
  }

  setConfig(cfg: Partial<StageConfig>) {
    const prev = this.cfg
    this.cfg = { ...this.cfg, ...cfg }
    const needsRebuild =
      !this.built ||
      prev.fans !== this.cfg.fans ||
      prev.colors.length !== this.cfg.colors.length ||
      prev.threeD !== this.cfg.threeD
    if (needsRebuild) this.rebuild()
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w)
    this.h = Math.max(1, h)
    this.rebuild()
  }

  show() {
    this.view.visible = true
  }

  hide() {
    this.view.visible = false
    this.view.alpha = 0
  }

  private k() {
    return Math.max(0.85, Math.min(1.9, this.w / 1300))
  }

  private rebuild() {
    const { w, h } = this
    this.built = true
    const k = this.k()

    /* 背景 */
    this.bg.texture = verticalGradient([
      { offset: 0, color: VENUE.top },
      { offset: 0.42, color: VENUE.mid },
      { offset: 0.72, color: VENUE.low },
      { offset: 1, color: VENUE.floor },
    ])
    this.bg.width = w
    this.bg.height = h

    /* 大屏 */
    const screenX = w * 0.12
    const screenY = h * 0.05
    const screenW = w * 0.76
    const screenH = h * 0.4
    this.screenG.clear()
    this.screenG
      .roundRect(screenX, screenY, screenW, screenH, 10)
      .fill({ color: 0x351a63, alpha: 0.78 })
    this.screenG
      .roundRect(screenX, screenY, screenW, screenH, 10)
      .stroke({ width: 1, color: 0xffffff, alpha: 0.06 })

    /* 屏幕色带 */
    for (const b of this.bands) b.s.destroy()
    this.bands = []
    const colors = this.cfg.colors.length ? this.cfg.colors : ['#ffcf6b']
    const bandCount = Math.max(6, colors.length * 2)
    for (let i = 0; i < bandCount; i++) {
      const s = new Sprite(fadeBar())
      s.anchor.set(0.5, 0)
      s.tint = hexNum(colors[i % colors.length])
      s.blendMode = 'add'
      s.alpha = 0.3
      s.x = screenX + ((i + 0.5) / bandCount) * screenW
      s.y = screenY
      s.width = screenW * 0.16
      s.height = screenH
      this.bandLayer.addChild(s)
      this.bands.push({ s, speed: 10 + (i % 5) * 6 })
    }

    /* 聚光灯 */
    for (const c of this.cones) c.destroy()
    this.cones = []
    const beamCount = Math.round(5 + this.cfg.intensity * 4)
    for (let i = 0; i < beamCount; i++) {
      const s = new Sprite(lightCone())
      s.anchor.set(0.5, 0)
      s.blendMode = 'add'
      s.tint = hexNum(colors[i % colors.length])
      s.alpha = 0.24
      s.x = w * (0.08 + (0.84 * i) / Math.max(1, beamCount - 1))
      s.y = -h * 0.06
      s.width = w * 0.4
      s.height = h * 0.86
      this.coneLayer.addChild(s)
      this.cones.push(s)
    }

    /* 舞台 */
    const stageTop = h * 0.68
    const stageH = h * 0.135
    this.stageG.clear()
    this.stageG
      .poly([w * 0.09, stageTop, w * 0.91, stageTop, w * 0.82, stageTop + stageH, w * 0.18, stageTop + stageH])
      .fill({ color: 0x2b1740, alpha: 1 })
    this.stageG
      .poly([w * 0.09, stageTop, w * 0.91, stageTop, w * 0.86, stageTop + stageH * 0.28, w * 0.14, stageTop + stageH * 0.28])
      .fill({ color: 0x6b3f9e, alpha: 0.38 })
    this.stageG
      .moveTo(w * 0.09, stageTop)
      .lineTo(w * 0.91, stageTop)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.4 })
    // 台口的光晕
    this.stageG
      .rect(w * 0.1, stageTop + stageH, w * 0.8, h * 0.02)
      .fill({ color: 0xffffff, alpha: 0.05 })

    /* 八个人 */
    for (const n of this.idols) n.root.destroy({ children: true })
    this.idols = []
    const n = Math.max(1, this.cfg.colors.length)
    for (let i = 0; i < n; i++) {
      const color = hexNum(colors[i])
      const root = new Container()
      const glow = new Sprite(softCircle())
      glow.anchor.set(0.5)
      glow.tint = color
      glow.blendMode = 'add'
      glow.alpha = 0.5
      glow.width = glow.height = 150 * k
      glow.y = -46 * k

      const bodyW = 11 * k
      const bodyH = 34 * k
      const headR = 9.5 * k

      const body = new Graphics()
      body
        .poly([-bodyW, 0, bodyW, 0, bodyW * 0.62, -bodyH, -bodyW * 0.62, -bodyH])
        .fill({ color, alpha: 0.95 })
      // 腿部的暗部
      body
        .poly([-bodyW, 0, bodyW, 0, bodyW * 0.9, -bodyH * 0.35, -bodyW * 0.9, -bodyH * 0.35])
        .fill({ color: 0x000000, alpha: 0.18 })

      const head = new Graphics()
      head.circle(0, -bodyH - headR * 0.8, headR).fill({ color: 0xfff6f0, alpha: 0.96 })

      const halo = new Graphics()
      halo
        .ellipse(0, -bodyH - headR * 2.6, 13 * k, 3.6 * k)
        .stroke({ width: 1.6, color, alpha: 0.95 })
      halo.visible = i < this.cfg.threeD

      root.addChild(glow, body, head, halo)
      root.x = w * (0.5 + ((i - (n - 1) / 2) / n) * 0.6)
      root.y = stageTop + stageH * 0.42
      this.idolLayer.addChild(root)
      this.idols.push({
        root,
        glow,
        body,
        head,
        halo,
        baseY: root.y,
        phase: i * 0.8,
        has3D: i < this.cfg.threeD,
      })
    }

    /* 观众灯牌 */
    for (const s of this.sticks) s.s.destroy()
    this.sticks = []
    const count = Math.max(24, Math.min(420, Math.round(Math.sqrt(Math.max(1, this.cfg.fans)) * 0.62)))
    for (let i = 0; i < count; i++) {
      const row = Math.floor((i / count) * 7)
      const rowCount = Math.max(1, Math.round((count / 7) * (1 + row * 0.22)))
      const col = i % rowCount
      const baseY = h * 0.83 + row * h * 0.032
      const spread = w * (0.58 + row * 0.075)
      const x = w / 2 + (col / Math.max(1, rowCount - 1) - 0.5) * spread + (Math.random() - 0.5) * 12
      const s = new Sprite(lightStick())
      s.anchor.set(0.5, 1)
      s.blendMode = 'add'
      s.tint = hexNum(colors[Math.floor(Math.random() * colors.length)])
      const sh = (20 + Math.random() * 20) * (1 - row * 0.05)
      s.width = 5 * k
      s.height = sh
      s.x = x
      s.y = baseY + Math.random() * 10
      s.alpha = 0.7 + Math.random() * 0.3
      this.crowdLayer.addChild(s)
      this.sticks.push({
        s,
        x,
        y: s.y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.9,
        h: sh,
      })
    }

    /* 粒子 */
    for (const p of this.particles) p.s.destroy()
    this.particles = []
    for (let i = 0; i < 70; i++) {
      const s = new Sprite(spark())
      s.anchor.set(0.5)
      s.blendMode = 'add'
      s.tint = hexNum(colors[Math.floor(Math.random() * colors.length)])
      s.alpha = 0
      s.width = s.height = 10 + Math.random() * 16
      this.particleLayer.addChild(s)
      this.particles.push({ s, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0 })
    }

    this.t = 0
  }

  /** 撒一把彩纸／星屑 */
  burst(n = 40) {
    const colors = this.cfg.colors.length ? this.cfg.colors : ['#ffffff']
    let used = 0
    for (const p of this.particles) {
      if (used >= n) break
      if (p.life > 0) continue
      used++
      p.x = Math.random() * this.w
      p.y = this.h * (0.6 + Math.random() * 0.28)
      p.vx = (Math.random() - 0.5) * 60
      p.vy = -(30 + Math.random() * 90)
      p.max = 1.6 + Math.random() * 1.4
      p.life = p.max
      p.s.tint = hexNum(colors[Math.floor(Math.random() * colors.length)])
      p.s.alpha = 1
    }
  }

  update(dt: number) {
    if (!this.built) return
    this.t += dt
    const t = this.t
    const w = this.w
    const beat = (t * 1.9) % 1
    const pulse = Math.pow(1 - beat, 3)

    // 入场淡入
    if (this.view.alpha < 1) this.view.alpha = Math.min(1, this.view.alpha + dt * 1.8)

    // 色带
    for (const b of this.bands) {
      b.s.x += b.speed * dt
      const span = w * 0.8
      const minX = w * 0.16
      if (b.s.x > minX + span) b.s.x = minX
      b.s.alpha = 0.22 + pulse * 0.16
    }

    // 聚光灯
    const intensity = this.cfg.intensity
    this.cones.forEach((c, i) => {
      c.rotation = Math.sin(t * (0.35 + i * 0.09) + i) * 0.1
      c.alpha = (0.2 + intensity * 0.42) * (0.7 + Math.sin(t * 0.8 + i) * 0.3)
    })

    // 人
    for (const id of this.idols) {
      const bob = Math.sin(t * 2.4 + id.phase) * 3 * this.k() + pulse * 3
      id.root.y = id.baseY + bob
      id.glow.alpha = 0.42 + pulse * 0.18
      if (id.has3D) id.halo.rotation = Math.sin(t * 1.6 + id.phase) * 0.12
    }

    // 灯牌
    for (const s of this.sticks) {
      const sway = Math.sin(t * s.speed + s.phase) * 4
      s.s.x = s.x + sway
      s.s.y = s.y - pulse * 4 * (s.speed - 0.4)
      s.s.rotation = sway * 0.01
    }

    // 粒子
    for (const p of this.particles) {
      if (p.life <= 0) {
        p.s.alpha = 0
        continue
      }
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 26 * dt
      p.vx *= 0.99
      p.s.x = p.x
      p.s.y = p.y
      p.s.alpha = Math.max(0, p.life / p.max)
      p.s.rotation += dt * 1.6
    }
  }

  destroy() {
    this.view.destroy({ children: true })
  }
}

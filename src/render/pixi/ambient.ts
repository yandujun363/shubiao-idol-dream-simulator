import { Container, Sprite, TilingSprite } from 'pixi.js'
import { softCircle, grain, verticalGradient } from './textures'
import { PIXI_PALETTE, type ResolvedTheme } from './palette'

interface Dust {
  sprite: Sprite
  x: number
  y: number
  vx: number
  vy: number
  r: number
  phase: number
}

/** 常驻的底噪层：渐变底 + 缓慢漂移的色斑 + 尘埃 */
export class AmbientScene {
  readonly view = new Container()
  private bg = new Sprite()
  private blobs: { sprite: Sprite; ox: number; oy: number; phase: number; speed: number; scale: number }[] = []
  private dust: Dust[] = []
  private grainSprite: TilingSprite
  private w = 1
  private h = 1
  private theme: ResolvedTheme = 'dark'

  constructor() {
    this.view.addChild(this.bg)
    this.grainSprite = new TilingSprite({ texture: grain(), width: 1, height: 1 })
    this.grainSprite.alpha = 0
    this.view.addChild(this.grainSprite)
  }

  setTheme(theme: ResolvedTheme) {
    if (this.theme === theme) return
    this.theme = theme
    this.rebuild()
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w)
    this.h = Math.max(1, h)
    this.rebuild()
  }

  private rebuild() {
    const p = PIXI_PALETTE[this.theme]
    const { w, h } = this

    // 背景
    this.bg.texture = verticalGradient([
      { offset: 0, color: p.bgTop },
      { offset: 0.55, color: p.bgMid },
      { offset: 1, color: p.bgBottom },
    ])
    this.bg.width = w
    this.bg.height = h

    // 色斑
    for (const b of this.blobs) b.sprite.destroy()
    this.blobs = []
    p.blobs.forEach((cfg, i) => {
      const s = new Sprite(softCircle())
      s.anchor.set(0.5)
      s.tint = cfg.color
      s.alpha = cfg.alpha
      s.blendMode = p.blobBlend
      const base = Math.max(w, h)
      s.width = s.height = base * cfg.size * 0.95
      this.view.addChildAt(s, 1)
      this.blobs.push({
        sprite: s,
        ox: i % 2 === 0 ? w * (0.18 + i * 0.1) : w * (0.82 - i * 0.08),
        oy: h * (0.12 + ((i * 0.23) % 0.6)),
        phase: i * 1.7,
        speed: 0.045 + i * 0.012,
        scale: cfg.size,
      })
    })

    // 尘埃
    for (const d of this.dust) d.sprite.destroy()
    this.dust = []
    const count = Math.round(Math.min(90, (w * h) / 26000))
    for (let i = 0; i < count; i++) {
      const s = new Sprite(softCircle())
      s.anchor.set(0.5)
      s.tint = p.dustColor
      s.alpha = p.dustAlpha * (0.35 + Math.random() * 0.65)
      s.blendMode = p.dustBlend
      const r = 2 + Math.random() * 5
      s.width = s.height = r * 2
      // 放进最上层（grain 之下）
      this.view.addChild(s)
      this.dust.push({
        sprite: s,
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 8,
        vy: -6 - Math.random() * 12,
        r,
        phase: Math.random() * Math.PI * 2,
      })
    }

    // 颗粒 + 暗角
    this.grainSprite.width = w
    this.grainSprite.height = h
    this.grainSprite.alpha = p.grainAlpha
    this.grainSprite.tileScale.set(1.2)
    this.view.addChild(this.grainSprite)
  }

  update(t: number, dt: number) {
    for (const b of this.blobs) {
      const ang = t * b.speed + b.phase
      b.sprite.x = b.ox + Math.sin(ang) * this.w * 0.06
      b.sprite.y = b.oy + Math.cos(ang * 0.8) * this.h * 0.05
      b.sprite.rotation = ang * 0.12
    }
    for (const d of this.dust) {
      d.x += d.vx * dt
      d.y += d.vy * dt
      if (d.y < -20) {
        d.y = this.h + 20
        d.x = Math.random() * this.w
      }
      if (d.x < -20) d.x = this.w + 20
      if (d.x > this.w + 20) d.x = -20
      d.sprite.x = d.x + Math.sin(t * 0.6 + d.phase) * 10
      d.sprite.y = d.y
      const tw = 0.55 + Math.sin(t * 1.4 + d.phase) * 0.45
      d.sprite.alpha = PIXI_PALETTE[this.theme].dustAlpha * tw
    }
  }

  destroy() {
    this.view.destroy({ children: true })
  }
}

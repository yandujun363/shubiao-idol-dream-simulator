import { Texture } from 'pixi.js'

/**
 * 程序化贴图工厂。
 * 这里用 canvas 画「素材」，再交给 Pixi 做 GPU 合成、混合与动画。
 */

const cache = new Map<string, Texture>()

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return { c, ctx }
}

function toTexture(c: HTMLCanvasElement, key: string): Texture {
  const tex = Texture.from(c)
  tex.label = key
  return tex
}

/** 柔光圆点：所有发光、光斑、粒子都用它 */
export function softCircle(): Texture {
  const key = 'softCircle'
  const hit = cache.get(key)
  if (hit) return hit
  const size = 256
  const { c, ctx } = canvasOf(size, size)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.28, 'rgba(255,255,255,0.72)')
  g.addColorStop(0.62, 'rgba(255,255,255,0.2)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = toTexture(c, key)
  cache.set(key, tex)
  return tex
}

/** 荧光棒贴图：竖向渐隐 + 横向柔边 */
export function lightStick(): Texture {
  const key = 'lightStick'
  const hit = cache.get(key)
  if (hit) return hit
  const W = 24
  const H = 96
  const { c, ctx } = canvasOf(W, H)
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    const vy = 1 - y / (H - 1)
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - (W - 1) / 2) / ((W - 1) / 2)
      const a = Math.pow(vy, 0.85) * Math.pow(Math.max(0, 1 - dx * dx), 2.2)
      const i = (y * W + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 255
      img.data[i + 2] = 255
      img.data[i + 3] = Math.round(a * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = toTexture(c, key)
  cache.set(key, tex)
  return tex
}

/** 聚光灯锥形：上窄下宽、整体竖向渐隐 */
export function lightCone(): Texture {
  const key = 'lightCone'
  const hit = cache.get(key)
  if (hit) return hit
  const W = 256
  const H = 512
  const { c, ctx } = canvasOf(W, H)
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1)
    const halfW = 5 + t * (W / 2 - 5)
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - (W - 1) / 2) / halfW
      const a = dx >= 1 ? 0 : Math.pow(1 - t, 1.35) * Math.pow(1 - dx * dx, 1.6)
      const i = (y * W + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 255
      img.data[i + 2] = 255
      img.data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = toTexture(c, key)
  cache.set(key, tex)
  return tex
}

/** 星屑：四角星 */
export function spark(): Texture {
  const key = 'spark'
  const hit = cache.get(key)
  if (hit) return hit
  const S = 64
  const { c, ctx } = canvasOf(S, S)
  const half = S / 2
  const g = ctx.createRadialGradient(half, half, 0, half, half, half)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(half, half, half, 0, Math.PI * 2)
  ctx.fill()
  // 十字光芒
  ctx.globalCompositeOperation = 'lighter'
  const run = (rot: number) => {
    ctx.save()
    ctx.translate(half, half)
    ctx.rotate(rot)
    const lg = ctx.createLinearGradient(0, -half, 0, half)
    lg.addColorStop(0, 'rgba(255,255,255,0)')
    lg.addColorStop(0.5, 'rgba(255,255,255,0.9)')
    lg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = lg
    ctx.fillRect(-1.5, -half, 3, S)
    ctx.restore()
  }
  run(0)
  run(Math.PI / 2)
  const tex = toTexture(c, key)
  cache.set(key, tex)
  return tex
}

/** 纸面颗粒（浅色主题用，给背景一点质感） */
export function grain(): Texture {
  const key = 'grain'
  const hit = cache.get(key)
  if (hit) return hit
  const S = 256
  const { c, ctx } = canvasOf(S, S)
  const img = ctx.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    const v = Math.random() * 255
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 26
  }
  ctx.putImageData(img, 0, 0)
  const tex = toTexture(c, key)
  tex.source.style.addressMode = 'repeat'
  cache.set(key, tex)
  return tex
}

/** 横向渐隐条：中间亮、两边透明（用于屏幕上的色带） */
export function fadeBar(): Texture {
  const key = 'fadeBar'
  const hit = cache.get(key)
  if (hit) return hit
  const W = 256
  const H = 8
  const { c, ctx } = canvasOf(W, H)
  const g = ctx.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.95)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const tex = toTexture(c, key)
  cache.set(key, tex)
  return tex
}

/** 竖直线性渐变（用于整屏背景） */
export function verticalGradient(stops: { offset: number; color: string }[]): Texture {
  const S = 128
  const { c, ctx } = canvasOf(4, S)
  const g = ctx.createLinearGradient(0, 0, 0, S)
  for (const s of stops) g.addColorStop(s.offset, s.color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, S)
  return toTexture(c, 'vg::' + stops.map((s) => s.color).join('-'))
}

export function disposeTextures(): void {
  for (const t of cache.values()) t.destroy(true)
  cache.clear()
}

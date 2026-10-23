import type { IdolDef } from '../engine/types'
import { darken, lighten, mix, seeded, withAlpha } from './color'

const W = 240
const H = 300

const SKIN = '#ffe3d3'
const SKIN_SHADOW = '#f2c3b2'
const LINE = '#3a2b3f'

interface Style {
  /** 后发长度 */
  length: number
  /** 后发半宽 */
  spread: number
  /** 刘海样式 */
  bangs: 'hime' | 'straight' | 'sweep' | 'wispy' | 'curtain'
  /** 附加发型 */
  extra: 'none' | 'twin' | 'ponytail' | 'sidepony' | 'longside'
}

const STYLES: Style[] = [
  { length: 148, spread: 58, bangs: 'hime', extra: 'longside' },
  { length: 120, spread: 54, bangs: 'straight', extra: 'twin' },
  { length: 96, spread: 50, bangs: 'sweep', extra: 'ponytail' },
  { length: 78, spread: 56, bangs: 'straight', extra: 'none' },
  { length: 52, spread: 50, bangs: 'wispy', extra: 'none' },
  { length: 158, spread: 62, bangs: 'curtain', extra: 'none' },
  { length: 104, spread: 52, bangs: 'wispy', extra: 'sidepony' },
  { length: 132, spread: 48, bangs: 'sweep', extra: 'longside' },
]

function facePath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(74, 118)
  ctx.bezierCurveTo(74, 86, 96, 66, 120, 66)
  ctx.bezierCurveTo(144, 66, 166, 86, 166, 118)
  ctx.bezierCurveTo(166, 152, 150, 178, 132, 190)
  ctx.bezierCurveTo(126, 194, 114, 194, 108, 190)
  ctx.bezierCurveTo(90, 178, 74, 152, 74, 118)
  ctx.closePath()
}

function drawBody(ctx: CanvasRenderingContext2D, def: IdolDef) {
  const suit = darken(def.color2, 0.35)
  // 脖子
  ctx.fillStyle = SKIN_SHADOW
  ctx.beginPath()
  ctx.roundRect(108, 172, 24, 30, 8)
  ctx.fill()

  // 肩
  const grad = ctx.createLinearGradient(0, 200, 0, 300)
  grad.addColorStop(0, suit)
  grad.addColorStop(1, darken(suit, 0.4))
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(64, 300)
  ctx.bezierCurveTo(64, 244, 88, 210, 120, 206)
  ctx.bezierCurveTo(152, 210, 176, 244, 176, 300)
  ctx.closePath()
  ctx.fill()

  // 领口
  ctx.fillStyle = lighten(suit, 0.18)
  ctx.beginPath()
  ctx.moveTo(120, 206)
  ctx.lineTo(140, 232)
  ctx.lineTo(120, 258)
  ctx.lineTo(100, 232)
  ctx.closePath()
  ctx.fill()

  // 领结 / 领带
  ctx.fillStyle = lighten(def.color, 0.35)
  ctx.beginPath()
  ctx.moveTo(120, 232)
  ctx.lineTo(128, 246)
  ctx.lineTo(112, 246)
  ctx.closePath()
  ctx.fill()

  // 荧光棒别针（一点偶像气味的装饰）
  ctx.fillStyle = withAlpha(def.color, 0.9)
  ctx.beginPath()
  ctx.arc(163, 274, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = withAlpha('#ffffff', 0.55)
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawBackHair(ctx: CanvasRenderingContext2D, def: IdolDef, style: Style) {
  const hair = def.color
  const dark = darken(hair, 0.28)
  const grad = ctx.createLinearGradient(120, 60, 120, 60 + style.length)
  grad.addColorStop(0, hair)
  grad.addColorStop(1, dark)
  ctx.fillStyle = grad

  // 主发团
  const s = style.spread
  const L = style.length
  ctx.beginPath()
  ctx.moveTo(120 - s + 4, 110)
  ctx.bezierCurveTo(120 - s - 10, 120 + L * 0.45, 120 - s + 14, 118 + L, 120, 118 + L + 6)
  ctx.bezierCurveTo(120 + s - 14, 118 + L, 120 + s + 10, 120 + L * 0.45, 120 + s - 4, 110)
  ctx.bezierCurveTo(120 + s - 6, 78, 152, 58, 120, 58)
  ctx.bezierCurveTo(88, 58, 120 - s + 6, 78, 120 - s + 4, 110)
  ctx.closePath()
  ctx.fill()

  // 附加发型
  if (style.extra === 'twin') {
    for (const dir of [-1, 1]) {
      const cx = 120 + dir * (s + 6)
      ctx.save()
      ctx.translate(cx, 118)
      ctx.rotate((dir * 14 * Math.PI) / 180)
      const g2 = ctx.createLinearGradient(0, -20, 0, 110)
      g2.addColorStop(0, lighten(hair, 0.08))
      g2.addColorStop(1, dark)
      ctx.fillStyle = g2
      ctx.beginPath()
      ctx.ellipse(0, 55, 20, 62, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  } else if (style.extra === 'ponytail') {
    ctx.save()
    ctx.translate(148, 66)
    ctx.rotate((22 * Math.PI) / 180)
    const g2 = ctx.createLinearGradient(0, 0, 0, 120)
    g2.addColorStop(0, hair)
    g2.addColorStop(1, dark)
    ctx.fillStyle = g2
    ctx.beginPath()
    ctx.moveTo(-16, 0)
    ctx.bezierCurveTo(12, 10, 26, 60, 8, 128)
    ctx.bezierCurveTo(-2, 96, -22, 50, -16, 0)
    ctx.fill()
    ctx.restore()
  } else if (style.extra === 'sidepony') {
    ctx.save()
    ctx.translate(64, 96)
    ctx.rotate((-28 * Math.PI) / 180)
    const g2 = ctx.createLinearGradient(0, 0, 0, 110)
    g2.addColorStop(0, hair)
    g2.addColorStop(1, dark)
    ctx.fillStyle = g2
    ctx.beginPath()
    ctx.ellipse(0, 58, 18, 60, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // 长发侧缕
  if (style.extra === 'longside' || style.length > 120) {
    for (const dir of [-1, 1]) {
      ctx.beginPath()
      const x = 120 + dir * (s - 2)
      ctx.moveTo(x, 112)
      ctx.bezierCurveTo(x + dir * 10, 160, x + dir * 2, 210, x + dir * 6, 244)
      ctx.bezierCurveTo(x + dir * 16, 200, x + dir * 20, 150, x + dir * 4, 108)
      ctx.fillStyle = darken(hair, 0.14)
      ctx.fill()
    }
  }
}

function drawHead(ctx: CanvasRenderingContext2D) {
  // 后颈阴影
  ctx.save()
  facePath(ctx)
  const g = ctx.createLinearGradient(0, 66, 0, 200)
  g.addColorStop(0, lighten(SKIN, 0.06))
  g.addColorStop(0.75, SKIN)
  g.addColorStop(1, SKIN_SHADOW)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 2.2
  ctx.strokeStyle = withAlpha(LINE, 0.55)
  ctx.stroke()
  ctx.restore()

  // 耳朵
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(120 + dir * 47, 124, 7, 12, 0, 0, Math.PI * 2)
    ctx.fillStyle = mix(SKIN, SKIN_SHADOW, 0.4)
    ctx.fill()
    ctx.strokeStyle = withAlpha(LINE, 0.3)
    ctx.lineWidth = 1.4
    ctx.stroke()
  }
}

function drawEyes(ctx: CanvasRenderingContext2D, def: IdolDef, blink: boolean) {
  const iris = mix(def.color, '#241a35', 0.42)
  const irisLight = lighten(def.color, 0.45)

  for (const [i, dir] of [-1, 1].entries()) {
    const ex = 120 + dir * 22
    const ey = 134
    const tilt = 0.1 + i * 0.02

    if (blink) {
      ctx.beginPath()
      ctx.moveTo(ex - 13, ey)
      ctx.quadraticCurveTo(ex, ey + 6, ex + 13, ey)
      ctx.strokeStyle = LINE
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.stroke()
      continue
    }

    // 眼白
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(ex, ey, 12.5, 14.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#fffaf7'
    ctx.fill()

    // 虹膜
    ctx.beginPath()
    const g = ctx.createLinearGradient(ex, ey - 12, ex, ey + 12)
    g.addColorStop(0, darken(iris, 0.25))
    g.addColorStop(0.55, iris)
    g.addColorStop(1, irisLight)
    ctx.fillStyle = g
    ctx.ellipse(ex, ey + 1, 9.5, 12, 0, 0, Math.PI * 2)
    ctx.fill()

    // 瞳孔
    ctx.beginPath()
    ctx.fillStyle = '#221733'
    ctx.ellipse(ex, ey + 2, 4.4, 6.2, 0, 0, Math.PI * 2)
    ctx.fill()

    // 高光
    ctx.beginPath()
    ctx.fillStyle = withAlpha('#ffffff', 0.95)
    ctx.ellipse(ex - 3.4, ey - 5.2, 3.6, 4.2, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.fillStyle = withAlpha('#ffffff', 0.6)
    ctx.ellipse(ex + 4.2, ey + 5, 1.9, 2.2, 0, 0, Math.PI * 2)
    ctx.fill()

    // 上眼线
    ctx.beginPath()
    ctx.moveTo(ex - 13, ey - 5)
    ctx.quadraticCurveTo(ex - 2, ey - 18 + tilt * 6, ex + 13, ey - 6)
    ctx.strokeStyle = LINE
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.stroke()

    // 睫毛
    ctx.beginPath()
    ctx.moveTo(ex + (dir > 0 ? 12 : -12), ey - 7)
    ctx.lineTo(ex + (dir > 0 ? 19 : -19), ey - 13)
    ctx.strokeStyle = LINE
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.restore()

    // 眉毛
    ctx.beginPath()
    ctx.moveTo(ex - 9, ey - 24)
    ctx.quadraticCurveTo(ex, ey - 28, ex + 9, ey - 23)
    ctx.strokeStyle = withAlpha(darken(def.color, 0.55), 0.75)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // 腮红
  for (const dir of [-1, 1]) {
    const g = ctx.createRadialGradient(120 + dir * 33, 158, 1, 120 + dir * 33, 158, 14)
    g.addColorStop(0, withAlpha('#ff7a9c', 0.42))
    g.addColorStop(1, withAlpha('#ff7a9c', 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(120 + dir * 33, 158, 14, 9, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 嘴
  ctx.beginPath()
  ctx.moveTo(116, 168)
  ctx.quadraticCurveTo(120, 173, 124, 168)
  ctx.strokeStyle = withAlpha('#b4556b', 0.9)
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.stroke()

  // 鼻子
  ctx.beginPath()
  ctx.moveTo(120, 152)
  ctx.lineTo(122, 155)
  ctx.strokeStyle = withAlpha(SKIN_SHADOW, 0.85)
  ctx.lineWidth = 1.6
  ctx.stroke()
}

function drawBangs(ctx: CanvasRenderingContext2D, def: IdolDef, style: Style, rnd: () => number) {
  const hair = def.color
  const g = ctx.createLinearGradient(0, 60, 0, 150)
  g.addColorStop(0, lighten(hair, 0.12))
  g.addColorStop(0.7, hair)
  g.addColorStop(1, darken(hair, 0.1))
  ctx.fillStyle = g

  const locks: { x: number; w: number; len: number; curve: number }[] = []
  switch (style.bangs) {
    case 'hime':
      locks.push({ x: 88, w: 22, len: 52, curve: -4 })
      locks.push({ x: 112, w: 20, len: 40, curve: 2 })
      locks.push({ x: 134, w: 22, len: 46, curve: 4 })
      locks.push({ x: 156, w: 20, len: 56, curve: -2 })
      break
    case 'straight':
      for (let i = 0; i < 5; i++) locks.push({ x: 84 + i * 15, w: 17, len: 44 + rnd() * 8, curve: 0 })
      break
    case 'sweep':
      locks.push({ x: 86, w: 26, len: 62, curve: -8 })
      locks.push({ x: 108, w: 24, len: 44, curve: -4 })
      locks.push({ x: 130, w: 22, len: 38, curve: 0 })
      locks.push({ x: 150, w: 26, len: 56, curve: 6 })
      break
    case 'wispy':
      for (let i = 0; i < 6; i++) locks.push({ x: 78 + i * 14, w: 13, len: 34 + rnd() * 14, curve: (i - 3) * 2 })
      break
    case 'curtain':
      locks.push({ x: 80, w: 24, len: 78, curve: -10 })
      locks.push({ x: 104, w: 26, len: 42, curve: -2 })
      locks.push({ x: 136, w: 26, len: 42, curve: 2 })
      locks.push({ x: 160, w: 24, len: 74, curve: 10 })
      break
  }

  for (const l of locks) {
    ctx.beginPath()
    const top = 62
    ctx.moveTo(l.x - l.w / 2, top)
    ctx.bezierCurveTo(l.x - l.w / 2 - 4, top + l.len * 0.55, l.x + l.curve - 6, top + l.len * 0.85, l.x + l.curve, top + l.len)
    ctx.bezierCurveTo(l.x + l.w / 2 + 6, top + l.len * 0.8, l.x + l.w / 2 + 2, top + l.len * 0.4, l.x + l.w / 2, top)
    ctx.closePath()
    ctx.fill()
  }

  // 头顶发盖
  ctx.beginPath()
  ctx.moveTo(72, 116)
  ctx.bezierCurveTo(70, 76, 96, 56, 120, 56)
  ctx.bezierCurveTo(146, 56, 172, 78, 168, 116)
  ctx.bezierCurveTo(160, 92, 146, 82, 120, 82)
  ctx.bezierCurveTo(96, 82, 80, 94, 72, 116)
  ctx.closePath()
  ctx.fill()

  // 高光
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(103, 78, 22, 7, -0.18, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha(lighten(hair, 0.55), 0.5)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(146, 86, 12, 4.5, 0.22, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha(lighten(hair, 0.5), 0.32)
  ctx.fill()
  ctx.restore()
}

function drawAccessory(ctx: CanvasRenderingContext2D, def: IdolDef, t: number) {

  if (def.line === 'light') {
    // 光环
    ctx.save()
    ctx.translate(120, 40)
    ctx.rotate(t * 0.25)
    ctx.beginPath()
    ctx.ellipse(0, 0, 26, 8, 0, 0, Math.PI * 2)
    const g = ctx.createLinearGradient(-26, 0, 26, 0)
    g.addColorStop(0, withAlpha(def.color, 0.15))
    g.addColorStop(0.5, withAlpha(def.color, 0.95))
    g.addColorStop(1, withAlpha(def.color, 0.15))
    ctx.strokeStyle = g
    ctx.lineWidth = 3
    ctx.shadowColor = def.color
    ctx.shadowBlur = 12
    ctx.stroke()
    ctx.restore()

    // 星屑
    for (let i = 0; i < 4; i++) {
      const a = t * 0.6 + i * 1.7
      const x = 120 + Math.cos(a) * 62
      const y = 96 + Math.sin(a * 1.3) * 46
      ctx.beginPath()
      ctx.arc(x, y, 1.6, 0, Math.PI * 2)
      ctx.fillStyle = withAlpha('#ffffff', 0.5 + Math.sin(a * 3) * 0.3)
      ctx.fill()
    }
  } else {
    // 宝石耳坠
    for (const dir of [-1, 1]) {
      const x = 120 + dir * 47
      const y = 142
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 5, y + 9)
      ctx.lineTo(x, y + 18)
      ctx.lineTo(x - 5, y + 9)
      ctx.closePath()
      const g = ctx.createLinearGradient(x - 5, y, x + 5, y + 18)
      g.addColorStop(0, lighten(def.color, 0.5))
      g.addColorStop(1, darken(def.color, 0.25))
      ctx.fillStyle = g
      ctx.shadowColor = def.color
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.shadowBlur = 0
    }
    // 折角闪
    const tw = 0.5 + Math.sin(t * 2.2) * 0.5
    ctx.beginPath()
    ctx.arc(166, 88, 2.4 * tw, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha('#ffffff', 0.8 * tw)
    ctx.fill()
  }
}

export interface AvatarOptions {
  size?: number
  blink?: boolean
  /** 背景透明度：0 = 透明，1 = 满 */
  bgOpacity?: number
  /** 动画时间（秒），用于光环/闪光 */
  time?: number
  /** 主题：决定底部渐隐与背景强度 */
  theme?: 'light' | 'dark'
}

/** 刘海在额头上压出的阴影 */
function drawForeheadShadow(ctx: CanvasRenderingContext2D) {
  ctx.save()
  facePath(ctx)
  ctx.clip()
  const g = ctx.createLinearGradient(0, 60, 0, 128)
  g.addColorStop(0, 'rgba(120, 80, 90, 0.42)')
  g.addColorStop(0.55, 'rgba(120, 80, 90, 0.16)')
  g.addColorStop(1, 'rgba(120, 80, 90, 0)')
  ctx.fillStyle = g
  ctx.fillRect(60, 56, 120, 90)
  ctx.restore()
}

/** 头发上的一道边缘光 */
function drawRimLight(ctx: CanvasRenderingContext2D, def: IdolDef) {
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.moveTo(80, 120)
  ctx.bezierCurveTo(78, 86, 98, 62, 122, 60)
  ctx.strokeStyle = lighten(def.color, 0.72)
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()
}

/** 发丝 */
function drawStrands(ctx: CanvasRenderingContext2D, def: IdolDef, style: Style) {
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = darken(def.color, 0.45)
  ctx.lineWidth = 1.4
  ctx.lineCap = 'round'
  for (const dir of [-1, 1]) {
    const x = 120 + dir * (style.spread * 0.62)
    ctx.beginPath()
    ctx.moveTo(x, 96)
    ctx.quadraticCurveTo(x + dir * 8, 150, x + dir * 3, 118 + style.length * 0.7)
    ctx.stroke()
  }
  ctx.restore()
}

/** 在 240x300 的逻辑坐标系里绘制 */
function paint(ctx: CanvasRenderingContext2D, def: IdolDef, opts: AvatarOptions) {
  const rnd = seeded(def.id)
  const theme = opts.theme ?? 'dark'

  // 背景
  const bgStrength = theme === 'light' ? 0.2 : 0.32
  const bg = ctx.createRadialGradient(120, 130, 20, 120, 150, 190)
  bg.addColorStop(0, withAlpha(def.color, bgStrength * (opts.bgOpacity ?? 1)))
  bg.addColorStop(1, withAlpha(def.color2, (theme === 'light' ? 0.04 : 0.06) * (opts.bgOpacity ?? 1)))
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const style = STYLES[def.look % STYLES.length]

  drawBackHair(ctx, def, style)
  drawBody(ctx, def)
  drawHead(ctx)
  drawForeheadShadow(ctx)
  drawEyes(ctx, def, opts.blink ?? false)
  drawBangs(ctx, def, style, rnd)
  drawStrands(ctx, def, style)
  drawRimLight(ctx, def)
  drawAccessory(ctx, def, opts.time ?? 0)

  // 底部渐隐：跟着主题走
  const fade = ctx.createLinearGradient(0, H - 64, 0, H)
  if (theme === 'light') {
    fade.addColorStop(0, 'rgba(247,242,232,0)')
    fade.addColorStop(1, 'rgba(247,242,232,0.72)')
  } else {
    fade.addColorStop(0, 'rgba(10,8,18,0)')
    fade.addColorStop(1, 'rgba(10,8,18,0.78)')
  }
  ctx.fillStyle = fade
  ctx.fillRect(0, H - 64, W, 64)
}

export function drawAvatar(canvas: HTMLCanvasElement, def: IdolDef, opts: AvatarOptions = {}): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const size = opts.size ?? 240
  const scale = size / W
  const h = Math.round(H * scale)

  canvas.width = Math.round(W * scale * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${Math.round(W * scale)}px`
  canvas.style.height = `${Math.round(h)}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
  ctx.clearRect(0, 0, W, H)
  paint(ctx, def, opts)
}

/** 小尺寸圆形头像（聚焦脸部） */
export function drawAvatarRound(canvas: HTMLCanvasElement, def: IdolDef, size = 72): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(size * dpr)
  canvas.height = Math.round(size * dpr)
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)

  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  const crop = 152
  ctx.translate(size / 2, size / 2)
  ctx.scale(size / crop, size / crop)
  ctx.translate(-120, -116)
  paint(ctx, def, { bgOpacity: 1, theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark' })
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2)
  ctx.stroke()
}

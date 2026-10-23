import { ref } from 'vue'
import { Application } from 'pixi.js'
import { AmbientScene } from './ambient'
import { StageScene, type StageConfig } from './stage'
import type { ResolvedTheme } from './palette'

/** 全应用共用一个 Pixi 上下文：背景层 + 舞台层 */
class Backdrop {
  private app: Application | null = null
  private ambient: AmbientScene | null = null
  private stage: StageScene | null = null
  private host: HTMLElement | null = null
  private theme: ResolvedTheme = 'dark'
  private booting: Promise<void> | null = null
  private t = 0
  private stageActive = false
  private stageWanted = false
  private pending: Partial<StageConfig> = {}

  /** Pixi 是否可用（失败时 UI 退回纯 CSS 背景） */
  readonly failed = ref(false)
  readonly ready = ref(false)

  attach(host: HTMLElement, theme: ResolvedTheme): Promise<void> {
    this.host = host
    this.theme = theme
    if (this.app) return Promise.resolve()
    if (this.booting) return this.booting
    this.booting = this.boot()
    return this.booting
  }

  private async boot() {
    const app = new Application()
    try {
      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        preference: 'webgl',
        powerPreference: 'high-performance',
      })
    } catch (e) {
      this.failed.value = true
      console.warn('[pixi] 初始化失败，使用 CSS 背景兜底', e)
      return
    }

    this.app = app
    app.canvas.style.position = 'absolute'
    app.canvas.style.inset = '0'
    app.canvas.style.width = '100%'
    app.canvas.style.height = '100%'
    app.canvas.style.display = 'block'
    this.host?.appendChild(app.canvas)

    const w = window.innerWidth
    const h = window.innerHeight

    this.ambient = new AmbientScene()
    this.ambient.resize(w, h)
    this.ambient.setTheme(this.theme)
    app.stage.addChild(this.ambient.view)

    this.stage = new StageScene()
    this.stage.resize(w, h)
    app.stage.addChild(this.stage.view)

    app.ticker.add((ticker) => this.frame(ticker.deltaMS / 1000))
    window.addEventListener('resize', this.onResize)

    this.ready.value = true
    if (this.stageWanted) this.showStage(this.pending)
    else this.ambient.resize(w, h)
  }

  private onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.app?.renderer.resize(w, h)
    this.ambient?.resize(w, h)
    this.stage?.resize(w, h)
  }

  private frame(dt: number) {
    const d = Math.min(dt, 0.05)
    this.t += d
    if (this.stageActive) {
      this.stage?.update(d)
    } else {
      this.ambient?.update(this.t, d)
    }
  }

  setTheme(theme: ResolvedTheme) {
    this.theme = theme
    this.ambient?.setTheme(theme)
  }

  showStage(cfg: Partial<StageConfig> = {}) {
    this.stageWanted = true
    this.pending = { ...this.pending, ...cfg }
    if (!this.stage) return
    this.stage.setConfig(this.pending)
    this.stageActive = true
    this.stage.show()
  }

  setStageConfig(cfg: Partial<StageConfig>) {
    this.pending = { ...this.pending, ...cfg }
    this.stage?.setConfig(cfg)
  }

  hideStage() {
    this.stageWanted = false
    this.stageActive = false
    this.stage?.hide()
  }

  burst(n = 40) {
    if (this.stageActive) this.stage?.burst(n)
  }

  detach() {
    window.removeEventListener('resize', this.onResize)
    this.app?.destroy(true, { children: true })
    this.app = null
    this.ambient = null
    this.stage = null
    this.host = null
    this.ready.value = false
  }
}

export const backdrop = new Backdrop()

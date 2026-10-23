export type ResolvedTheme = 'light' | 'dark'

export interface PixiPalette {
  bgTop: string
  bgMid: string
  bgBottom: string
  blobs: { color: number; alpha: number; size: number }[]
  blobBlend: 'add' | 'normal'
  dustColor: number
  dustAlpha: number
  dustBlend: 'add' | 'normal'
  grainAlpha: number
  vignette: number
}

export const PIXI_PALETTE: Record<ResolvedTheme, PixiPalette> = {
  dark: {
    bgTop: '#0b0716',
    bgMid: '#08060f',
    bgBottom: '#05040b',
    blobs: [
      { color: 0x7c4dff, alpha: 0.16, size: 1.0 },
      { color: 0xff5fa8, alpha: 0.11, size: 0.82 },
      { color: 0xffcf6b, alpha: 0.07, size: 0.66 },
      { color: 0x3fd7ff, alpha: 0.06, size: 0.54 },
    ],
    blobBlend: 'add',
    dustColor: 0xd9ccff,
    dustAlpha: 0.5,
    dustBlend: 'add',
    grainAlpha: 0,
    vignette: 0.55,
  },
  light: {
    bgTop: '#fdfaf3',
    bgMid: '#f7f1e6',
    bgBottom: '#efe7d8',
    blobs: [
      { color: 0xffbed7, alpha: 0.46, size: 0.92 },
      { color: 0xcdbcff, alpha: 0.36, size: 0.78 },
      { color: 0xffe4b0, alpha: 0.4, size: 0.66 },
      { color: 0xbfe9f2, alpha: 0.24, size: 0.52 },
    ],
    blobBlend: 'normal',
    dustColor: 0xb7a4c9,
    dustAlpha: 0.3,
    dustBlend: 'normal',
    grainAlpha: 0.55,
    vignette: 0.1,
  },
}

/** 演出（Live）永远是暗的：这是一个直播间里的虚拟舞台 */
export const VENUE = {
  top: '#05040c',
  mid: '#0d0820',
  low: '#160b25',
  floor: '#06040c',
  stageTop: '#241335',
  stageBottom: '#0b0614',
}

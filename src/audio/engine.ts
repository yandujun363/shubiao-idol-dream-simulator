/**
 * 全程序化音频引擎。
 * 没有任何音频素材：BGM 由振荡器 + 噪声实时合成，
 * 音效同样由合成器生成。
 *
 * BGM 的写法：
 * - 每首 8 小节循环，和弦带七度 / 九度色彩音，避免三和弦来回撞；
 * - 有摇摆、有力度层次、有轻微时值抖动，不再每个 16 分音符都像节拍器；
 * - 鼓组带重音、开镲、加花与每 8 小节一次的留白；
 * - 低音/琶音/主旋律共用一条侧链，底鼓落下时让出一点空间；
 * - 混响、附点八分延迟和总线压缩器负责把声音粘在一起。
 */

export type Mood = 'title' | 'day' | 'build' | 'tense' | 'live' | 'sad' | 'victory' | 'silent'

interface Chord {
  /** 和弦垫的音高（MIDI，C4 附近） */
  pad: number[]
  /** 低音根音（MIDI，C2–C3） */
  bass: number
}

interface TrackDef {
  bpm: number
  /** 16 分音符的摇摆量：0 = 平均，0.15 ≈ 有点懒 */
  swing: number
  chords: Chord[]
  /** 16 步低音型：相对根音的半音偏移，null = 休止 */
  bass: (number | null)[]
  /** 16 步琶音型：索引和弦音，超出一个八度会自动升高 */
  arp: (number | null)[]
  /** 16 步主旋律型：索引和弦音，空 = 休止 */
  lead: (number | null)[]
  /** k/K 底鼓、s/S 军鼓、h 闭镲、H 开镲、x 鬼镲、. 休止 */
  drums: string
  padGain: number
  arpGain: number
  leadGain: number
  wave: OscillatorType
  leadWave: OscillatorType
  /** 低通截止（整体亮度） */
  cut: number
  /** 混响送出量 */
  reverb: number
}

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

/** 把和弦音按八度展开：索引 0..n-1 是本和弦，n..2n-1 升一个八度 */
function chordTone(notes: number[], index: number, octave: number): number {
  const n = notes.length
  const i = ((index % n) + n) % n
  return notes[i] + octave + Math.floor(index / n) * 12
}

const ch = (bass: number, pad: number[]): Chord => ({ bass, pad })

/* ------------------------------------------------------------------ */
/* 曲目                                                                */
/* ------------------------------------------------------------------ */

const TRACKS: Record<Exclude<Mood, 'silent'>, TrackDef> = {
  /* 标题：Am9 – Fmaj9 – Cmaj7 – G6/9，慢、空、留白多 */
  title: {
    bpm: 74,
    swing: 0.15,
    chords: [
      ch(45, [57, 60, 64, 67, 71]),
      ch(41, [53, 57, 60, 64, 67]),
      ch(48, [55, 59, 60, 64, 67]),
      ch(43, [55, 59, 62, 64, 69]),
      ch(45, [57, 60, 64, 67, 71]),
      ch(41, [53, 57, 60, 64, 67]),
      ch(38, [50, 53, 57, 60, 64]),
      ch(40, [52, 57, 59, 62, 64]),
    ],
    bass: [0, null, null, null, null, null, null, null, 0, null, null, null, null, null, 7, null],
    arp: [0, null, 2, null, 1, null, 3, null, 0, null, 2, null, 3, null, 1, 2],
    lead: [null, 2, null, null, null, null, 4, null, null, 3, null, null, null, null, 1, null],
    drums: '',
    padGain: 0.17,
    arpGain: 0.048,
    leadGain: 0.036,
    wave: 'triangle',
    leadWave: 'sine',
    cut: 1700,
    reverb: 0.4,
  },

  /* 日常：C – Am – F – G，轻快但不吵 */
  day: {
    bpm: 90,
    swing: 0.1,
    chords: [
      ch(48, [55, 59, 60, 64]),
      ch(45, [57, 60, 64, 67]),
      ch(41, [53, 57, 60, 64]),
      ch(43, [55, 59, 62, 64, 67]),
      ch(48, [55, 59, 60, 64]),
      ch(40, [52, 55, 59, 62]),
      ch(41, [53, 57, 60, 64]),
      ch(43, [55, 60, 62, 65]),
    ],
    bass: [0, null, null, null, 0, null, 7, null, 0, null, null, null, 12, null, 7, null],
    arp: [0, null, 1, null, 2, null, 1, null, 3, null, 2, null, 1, null, 0, 1],
    lead: [null, null, 2, null, null, 3, null, null, null, null, 1, null, 2, null, null, null],
    drums: 'K..h..h.S..h..h.',
    padGain: 0.15,
    arpGain: 0.05,
    leadGain: 0.034,
    wave: 'triangle',
    leadWave: 'triangle',
    cut: 2100,
    reverb: 0.3,
  },

  /* 建设期：F – G – Am – G，八分音符推进 */
  build: {
    bpm: 104,
    swing: 0.06,
    chords: [
      ch(41, [53, 57, 60, 64]),
      ch(43, [55, 59, 62, 67]),
      ch(45, [57, 60, 64, 67]),
      ch(43, [55, 59, 62, 67]),
      ch(41, [53, 57, 60, 64]),
      ch(48, [55, 59, 60, 64]),
      ch(43, [55, 59, 62, 67]),
      ch(45, [57, 60, 64, 67]),
    ],
    bass: [0, null, 0, null, 12, null, 0, null, 0, null, 0, null, 12, null, 7, null],
    arp: [0, 1, 2, 1, 3, 1, 2, 1, 0, 1, 2, 1, 3, 2, 1, 2],
    lead: [null, null, 3, null, null, 2, null, null, 1, null, null, 3, null, 2, null, null],
    drums: 'k.h.s.h.k.hks.hh',
    padGain: 0.14,
    arpGain: 0.046,
    leadGain: 0.032,
    wave: 'sawtooth',
    leadWave: 'triangle',
    cut: 2400,
    reverb: 0.26,
  },

  /* 危机：Dm – Bb – Gm – A，直、暗、稀疏 */
  tense: {
    bpm: 84,
    swing: 0,
    chords: [
      ch(38, [50, 53, 57, 60, 64]),
      ch(46, [53, 57, 58, 62]),
      ch(43, [55, 58, 62, 65]),
      ch(45, [57, 61, 64, 67]),
      ch(38, [50, 53, 57, 60, 64]),
      ch(46, [53, 57, 58, 62]),
      ch(43, [55, 58, 62, 65]),
      ch(45, [57, 61, 64, 67]),
    ],
    bass: [0, null, null, null, null, null, null, null, 0, null, null, null, null, null, 7, null],
    arp: [null, null, 2, null, null, null, null, null, null, 1, null, null, null, null, 3, null],
    lead: [],
    drums: 'k.......k...h...',
    padGain: 0.18,
    arpGain: 0.038,
    leadGain: 0,
    wave: 'sawtooth',
    leadWave: 'sine',
    cut: 980,
    reverb: 0.46,
  },

  /* 线上演唱会：C – G – Am – F，128 BPM，满编 */
  live: {
    bpm: 128,
    swing: 0.04,
    chords: [
      ch(48, [55, 59, 60, 64]),
      ch(43, [55, 59, 62, 67]),
      ch(45, [57, 60, 64, 67]),
      ch(41, [53, 57, 60, 64]),
      ch(48, [55, 59, 60, 64]),
      ch(43, [55, 59, 62, 67]),
      ch(41, [53, 57, 60, 64]),
      ch(43, [55, 59, 62, 67]),
    ],
    bass: [0, null, 0, null, 12, null, 7, null, 0, null, 0, null, 12, null, 7, null],
    arp: [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 4, 2, 3, 2],
    lead: [null, null, null, 3, null, null, 2, null, null, null, 1, null, null, 2, null, null],
    drums: 'K.h.S.h.K.h.S.hH',
    padGain: 0.15,
    arpGain: 0.052,
    leadGain: 0.038,
    wave: 'sawtooth',
    leadWave: 'triangle',
    cut: 3100,
    reverb: 0.3,
  },

  /* BE：Am9 – Fmaj7 – Cmaj7 – G，慢速、没有鼓 */
  sad: {
    bpm: 60,
    swing: 0.17,
    chords: [
      ch(45, [57, 60, 64, 67, 71]),
      ch(41, [53, 57, 60, 64]),
      ch(48, [55, 59, 60, 64]),
      ch(43, [55, 59, 62, 64, 67]),
      ch(45, [57, 60, 64, 67, 71]),
      ch(41, [53, 57, 60, 64]),
      ch(38, [50, 53, 57, 60]),
      ch(40, [52, 57, 59, 64]),
    ],
    bass: [0, null, null, null, null, null, null, null, 0, null, null, null, null, null, 7, null],
    arp: [0, null, null, 2, null, 1, null, null, 2, null, null, 3, null, 1, null, null],
    lead: [null, null, 2, null, null, null, null, null, null, 1, null, null, null, null, 3, null],
    drums: '',
    padGain: 0.18,
    arpGain: 0.044,
    leadGain: 0.036,
    wave: 'sine',
    leadWave: 'sine',
    cut: 1350,
    reverb: 0.46,
  },

  /* HE：C – G – Am – F，明亮、带一点庆祝的切分 */
  victory: {
    bpm: 116,
    swing: 0.07,
    chords: [
      ch(48, [55, 59, 60, 64, 67]),
      ch(43, [55, 59, 62, 67]),
      ch(45, [57, 60, 64, 67]),
      ch(41, [53, 57, 60, 64, 67]),
      ch(48, [55, 59, 60, 64, 67]),
      ch(43, [55, 59, 62, 67]),
      ch(41, [53, 57, 60, 64, 67]),
      ch(43, [55, 59, 62, 67]),
    ],
    bass: [0, null, 7, null, 12, null, 7, null, 0, null, 7, null, 12, null, 7, null],
    arp: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1],
    lead: [3, null, null, 2, null, null, 1, null, 2, null, 3, null, null, 2, null, 1],
    drums: 'K.h.S.h.K.h.S.hH',
    padGain: 0.15,
    arpGain: 0.048,
    leadGain: 0.04,
    wave: 'triangle',
    leadWave: 'triangle',
    cut: 2900,
    reverb: 0.32,
  },
}

/* ------------------------------------------------------------------ */
/* 引擎                                                                */
/* ------------------------------------------------------------------ */

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null

  /* 音乐总线：乐音先过侧链，再和鼓一起进 musicBus */
  private tonalBus: GainNode | null = null
  private duckBus: GainNode | null = null
  private reverbSend: GainNode | null = null
  private delaySend: GainNode | null = null
  private delay: DelayNode | null = null

  private timer: number | null = null
  private step = 0
  private absStep = 0
  private nextTime = 0
  private mood: Mood = 'silent'

  volume = 0.72
  musicVolume = 0.55
  sfxVolume = 0.7
  enabled = true

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running'
  }

  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return
    }
    const Ctor: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    this.ctx = ctx

    // master → 总线压缩 → 扬声器。压缩器不是“响”，是让所有声音抱在一起
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -15
    comp.knee.value = 20
    comp.ratio.value = 3
    comp.attack.value = 0.004
    comp.release.value = 0.3
    comp.connect(ctx.destination)

    const master = ctx.createGain()
    master.gain.value = this.enabled ? this.volume : 0
    master.connect(comp)
    this.master = master

    const musicBus = ctx.createGain()
    musicBus.gain.value = this.musicVolume
    musicBus.connect(master)
    this.musicBus = musicBus

    const sfxBus = ctx.createGain()
    sfxBus.gain.value = this.sfxVolume
    sfxBus.connect(master)
    this.sfxBus = sfxBus

    /* 侧链：底鼓时只压乐音，不压鼓本身 */
    const duckBus = ctx.createGain()
    duckBus.gain.value = 1
    duckBus.connect(musicBus)
    this.duckBus = duckBus

    const tonalBus = ctx.createGain()
    tonalBus.gain.value = 1
    tonalBus.connect(duckBus)
    this.tonalBus = tonalBus

    /* 混响：带预延迟、越到尾部越闷的噪声脉冲，比纯白噪声自然 */
    const len = Math.floor(ctx.sampleRate * 2.4)
    const pre = Math.floor(ctx.sampleRate * 0.02)
    const impulse = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c)
      let lp = 0
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / (len - pre)
        const n = Math.random() * 2 - 1
        const k = 0.08 + 0.5 * Math.exp(-t * 2.2)
        lp += (n - lp) * k
        data[i] = lp * Math.pow(1 - t, 2.8) * (c === 0 ? 1 : 0.94)
      }
    }
    const reverb = ctx.createConvolver()
    reverb.buffer = impulse
    const reverbGain = ctx.createGain()
    reverbGain.gain.value = 0.5
    reverb.connect(reverbGain)
    reverbGain.connect(musicBus)

    const reverbSend = ctx.createGain()
    reverbSend.gain.value = 0.3
    reverbSend.connect(reverb)
    this.reverbSend = reverbSend

    /* 附点八分延迟：只送给琶音和主旋律，给一点尾巴和空间 */
    const delay = ctx.createDelay(1.5)
    delay.delayTime.value = 0.42
    const damp = ctx.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = 2600
    const feedback = ctx.createGain()
    feedback.gain.value = 0.28
    const delayPan = ctx.createStereoPanner()
    delayPan.pan.value = -0.32
    delay.connect(damp)
    damp.connect(feedback)
    feedback.connect(delay)
    damp.connect(delayPan)
    delayPan.connect(musicBus)
    const delaySend = ctx.createGain()
    delaySend.gain.value = 0.3
    delaySend.connect(delay)
    this.delay = delay
    this.delaySend = delaySend

    if (ctx.state === 'suspended') await ctx.resume()

    // 如果 setMood 在 init 之前被调用过，这里把等待中的曲目接上
    if (this.mood !== 'silent') {
      const track = TRACKS[this.mood as Exclude<Mood, 'silent'>]
      this.reverbSend.gain.value = track.reverb
      this.delay.delayTime.value = (60 / track.bpm) * 0.75
      this.start()
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05)
    }
    if (!on) this.setMood('silent')
  }

  setMood(mood: Mood) {
    if (this.mood === mood) return
    this.mood = mood

    if (mood === 'silent') {
      this.stop()
      if (this.musicBus && this.ctx) {
        this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25)
      }
      return
    }

    if (!this.ctx) return
    const track = TRACKS[mood as Exclude<Mood, 'silent'>]
    const wasPlaying = this.timer !== null
    const now = this.ctx.currentTime

    if (this.musicBus) {
      this.musicBus.gain.cancelScheduledValues(now)
      if (wasPlaying) {
        // 切歌时先压一下，避免两首曲子的尾音撞在一起
        this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.55, now, 0.035)
        this.musicBus.gain.setTargetAtTime(this.musicVolume, now + 0.09, 0.14)
      } else {
        this.musicBus.gain.setTargetAtTime(this.musicVolume, now, 0.35)
      }
    }
    if (this.reverbSend) {
      this.reverbSend.gain.setTargetAtTime(track.reverb, now, 0.2)
    }
    if (this.delay) {
      this.delay.delayTime.setTargetAtTime((60 / track.bpm) * 0.75, now, 0.12)
    }

    // 切歌时从小节头开始，不要把上一首的第七小节带过来
    this.step = 0
    this.absStep = 0
    if (this.timer !== null) {
      this.nextTime = now + 0.06
    }
    this.start()
  }

  private start() {
    if (!this.ctx || this.timer !== null) return
    this.step = 0
    this.absStep = 0
    this.nextTime = this.ctx.currentTime + 0.1
    this.timer = window.setInterval(() => this.schedule(), 25)
  }

  private stop() {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx) return
    const track = TRACKS[this.mood as Exclude<Mood, 'silent'>]
    if (!track) return
    const stepDur = 60 / track.bpm / 4
    const total = track.chords.length * 16
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(track, this.step, this.absStep, this.nextTime, stepDur)
      this.step = (this.step + 1) % total
      this.absStep += 1
      this.nextTime += stepDur
    }
  }

  private playStep(track: TrackDef, step: number, absStep: number, time: number, dur: number) {
    const s16 = step % 16
    const bar = Math.floor(step / 16)
    const chord = track.chords[bar % track.chords.length]

    // 摇摆只推迟每个反拍 16 分音符，正拍保持稳
    const swing = s16 % 2 === 1 ? track.swing * dur : 0
    const t = time + swing
    const accent = s16 % 8 === 0 ? 1.18 : s16 % 4 === 0 ? 1.06 : s16 % 2 === 0 ? 0.96 : 0.84
    const vel = 0.94 + Math.random() * 0.12

    const globalBar = Math.floor(absStep / 16)
    const lastBar = track.chords.length - 1
    const hasDrums = track.drums.length > 0
    const intro = globalBar === 0
    const breakBar = hasDrums && bar === lastBar
    const inFill = hasDrums && bar === lastBar - 1 && s16 >= 12

    // 和弦垫：每个小节换一次，尾巴稍微拖过去，和下一小节接上
    if (s16 === 0) {
      this.pad(chord.pad, time, dur * 16 * 1.12, track.padGain, track.cut)
    }

    // 低音：按到下一个低音为止，让长音有真实的连接感
    const bassOff = track.bass[s16]
    if (bassOff !== null && bassOff !== undefined) {
      const len = this.noteLen(track.bass, s16, dur, 4)
      this.bass(NOTE(chord.bass + bassOff), time + this.jitter(0.003), len, 0.15, s16 % 8 === 0 ? 1 : 0.82)
    }

    // 琶音：带重音、左右微偏、轻微抖动
    const arpIdx = track.arp[s16]
    if (arpIdx !== null && arpIdx !== undefined) {
      const note = chordTone(chord.pad, arpIdx, 12)
      this.pluck(
        NOTE(note),
        t + this.jitter(0.005),
        dur * 2.2,
        track.arpGain * accent * vel * (breakBar ? 0.75 : 1),
        track.wave,
        track.cut,
        s16 % 2 === 0 ? -0.16 : 0.2,
      )
    }

    // 主旋律：长音 + 揉弦，给循环一条能记住的线
    const leadIdx = track.lead[s16]
    if (leadIdx !== null && leadIdx !== undefined) {
      const note = chordTone(chord.pad, leadIdx, 12)
      const len = this.noteLen(track.lead, s16, dur, 6)
      this.lead(NOTE(note), t + this.jitter(0.007), len * 1.05, track.leadGain * accent * vel, track.leadWave, 0.12)
    }

    if (!hasDrums) return

    const d = track.drums[s16] ?? '.'
    const dv = 0.88 + Math.random() * 0.2
    const hatPan = s16 % 4 === 2 ? 0.24 : s16 % 4 === 0 ? -0.18 : 0.08

    if (inFill) {
      // 进入留白前的小加花：只留军鼓和一点镲
      if (s16 === 12) {
        this.hat(t, 0.05, true, -0.22)
        this.snare(time, 0.62)
      } else if (s16 === 13) {
        this.snare(time, 0.72)
      } else if (s16 === 14) {
        this.snare(time, 0.85)
      } else if (s16 === 15) {
        this.snare(time, 1)
      }
      return
    }

    // 首小节和每 8 小节的最后一小节留白：有呼吸，循环才不烦
    if (intro || breakBar) {
      if (d === 'h' || d === 'H' || d === 'x') {
        this.hat(t, (d === 'H' ? 0.04 : 0.024) * dv, d === 'H', hatPan)
      }
      return
    }

    switch (d) {
      case 'k':
        this.kick(time, 0.68 * dv)
        break
      case 'K':
        this.kick(time, 0.95 * dv)
        break
      case 's':
        this.snare(time, 0.68 * dv)
        break
      case 'S':
        this.snare(time, 1 * dv)
        break
      case 'h':
        this.hat(t + this.jitter(0.004), 0.038 * dv, false, hatPan)
        break
      case 'H':
        this.hat(t, 0.052 * dv, true, hatPan)
        break
      case 'x':
        this.hat(t + this.jitter(0.006), 0.014 * dv, false, hatPan)
        break
    }
  }

  /* ---------------- 合成单元 ---------------- */

  private jitter(maxSec: number): number {
    return (Math.random() * 2 - 1) * maxSec
  }

  /** 从当前步往后找下一个同声部音符，决定这个音该按多久 */
  private noteLen(pattern: (number | null)[], s16: number, stepDur: number, fallback: number): number {
    for (let i = 1; i <= 8; i++) {
      const v = pattern[(s16 + i) % 16]
      if (v !== null && v !== undefined) return Math.max(1, i) * stepDur * 0.94
    }
    return fallback * stepDur
  }

  /** 底鼓落下时给乐音让出一点空间，幅度很小，只做“呼吸” */
  private duck(time: number) {
    const duck = this.duckBus
    if (!duck) return
    duck.gain.setTargetAtTime(0.8, time, 0.012)
    duck.gain.setTargetAtTime(1, time + 0.045, 0.1)
  }

  private pad(notes: number[], time: number, dur: number, gain: number, cut: number) {
    const ctx = this.ctx!
    const bus = this.tonalBus!
    const send = this.reverbSend
    const per = gain / (notes.length * 2)

    // 很慢的音高漂移：让和弦垫“呼吸”，不是一块冻住的锯齿
    const drift = ctx.createOscillator()
    drift.type = 'sine'
    drift.frequency.value = 0.09 + Math.random() * 0.06
    const driftAmt = ctx.createGain()
    driftAmt.gain.value = 3.4
    drift.connect(driftAmt)
    drift.start(time)
    drift.stop(time + dur)

    notes.forEach((note, i) => {
      const pan = ctx.createStereoPanner()
      pan.pan.value = (i % 2 === 0 ? -1 : 1) * 0.3

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.Q.value = 0.45
      filter.frequency.setValueAtTime(cut * 0.55, time)
      filter.frequency.linearRampToValueAtTime(cut, time + 0.8)
      filter.frequency.linearRampToValueAtTime(cut * 0.7, time + dur)

      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, time)
      env.gain.linearRampToValueAtTime(per, time + 0.65)
      env.gain.setValueAtTime(per, time + dur * 0.62)
      env.gain.exponentialRampToValueAtTime(0.0001, time + dur)

      filter.connect(env)
      env.connect(pan)
      pan.connect(bus)
      if (send) pan.connect(send)

      for (const det of [-7, 7]) {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.value = NOTE(note)
        osc.detune.value = det
        driftAmt.connect(osc.detune)
        osc.connect(filter)
        osc.start(time)
        osc.stop(time + dur + 0.06)
      }
    })
  }

  private pluck(
    freq: number,
    time: number,
    dur: number,
    gain: number,
    wave: OscillatorType,
    cut: number,
    pan: number,
  ) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = wave
    osc.frequency.value = freq
    osc.detune.value = (Math.random() * 2 - 1) * 4

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(Math.max(600, cut * 1.1), time)
    filter.frequency.exponentialRampToValueAtTime(Math.max(320, cut * 0.26), time + dur)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, time)
    env.gain.exponentialRampToValueAtTime(gain, time + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0004, time + dur)

    const panner = ctx.createStereoPanner()
    panner.pan.value = pan

    osc.connect(filter)
    filter.connect(env)
    env.connect(panner)
    panner.connect(this.tonalBus!)
    if (this.reverbSend) panner.connect(this.reverbSend)
    if (this.delaySend) panner.connect(this.delaySend)

    osc.start(time)
    osc.stop(time + dur + 0.05)
  }

  private lead(freq: number, time: number, dur: number, gain: number, wave: OscillatorType, pan: number) {
    const ctx = this.ctx!
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 3000
    filter.Q.value = 0.4

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, time)
    env.gain.linearRampToValueAtTime(gain, time + 0.07)
    env.gain.setValueAtTime(gain, time + dur * 0.55)
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur)

    const panner = ctx.createStereoPanner()
    panner.pan.value = pan

    for (const [det, level] of [
      [-4, 1],
      [5, 0.55],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = wave
      osc.frequency.value = freq
      osc.detune.value = det

      // 很浅的揉弦，让它不像一条直线
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 4.7 + Math.random() * 0.6
      const depth = ctx.createGain()
      depth.gain.value = 5 + Math.random() * 2
      lfo.connect(depth)
      depth.connect(osc.detune)
      lfo.start(time)
      lfo.stop(time + dur + 0.05)

      const g = ctx.createGain()
      g.gain.value = level
      osc.connect(g)
      g.connect(filter)
      osc.start(time)
      osc.stop(time + dur + 0.05)
    }

    filter.connect(env)
    env.connect(panner)
    panner.connect(this.tonalBus!)
    if (this.reverbSend) panner.connect(this.reverbSend)
    if (this.delaySend) panner.connect(this.delaySend)
  }

  private bass(freq: number, time: number, dur: number, gain: number, accent: number) {
    const ctx = this.ctx!
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 0.7
    filter.frequency.setValueAtTime(1000, time)
    filter.frequency.exponentialRampToValueAtTime(320, time + 0.14)

    const env = ctx.createGain()
    const peak = gain * accent
    env.gain.setValueAtTime(0.0001, time)
    env.gain.exponentialRampToValueAtTime(peak, time + 0.012)
    env.gain.exponentialRampToValueAtTime(peak * 0.55, time + 0.12)
    env.gain.exponentialRampToValueAtTime(0.0004, time + dur)

    filter.connect(env)
    env.connect(this.tonalBus!)

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = freq / 2
    const subGain = ctx.createGain()
    subGain.gain.value = 0.45
    osc.connect(filter)
    sub.connect(subGain)
    subGain.connect(filter)
    osc.start(time)
    sub.start(time)
    osc.stop(time + dur + 0.05)
    sub.stop(time + dur + 0.05)
  }

  private noiseBuffer(dur: number): AudioBuffer {
    const ctx = this.ctx!
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  private kick(time: number, accent: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(138, time)
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.1)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, time)
    env.gain.linearRampToValueAtTime(0.52 * accent, time + 0.003)
    env.gain.exponentialRampToValueAtTime(0.0005, time + 0.26)
    osc.connect(env)
    env.connect(this.musicBus!)
    osc.start(time)
    osc.stop(time + 0.28)

    // 一点点 click，让底鼓在小喇叭上也听得见
    const click = ctx.createBufferSource()
    click.buffer = this.noiseBuffer(0.02)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2600
    const cg = ctx.createGain()
    cg.gain.setValueAtTime(0.05 * accent, time)
    cg.gain.exponentialRampToValueAtTime(0.0004, time + 0.02)
    click.connect(hp)
    hp.connect(cg)
    cg.connect(this.musicBus!)
    click.start(time)

    this.duck(time)
  }

  private snare(time: number, accent: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(0.2)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1850
    bp.Q.value = 0.9
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.17 * accent, time)
    env.gain.exponentialRampToValueAtTime(0.0004, time + 0.16)
    src.connect(bp)
    bp.connect(env)
    env.connect(this.musicBus!)
    if (this.reverbSend) env.connect(this.reverbSend)
    src.start(time)

    // 军鼓的“鼓皮”音，只有噪声会太薄
    const body = ctx.createOscillator()
    body.type = 'triangle'
    body.frequency.setValueAtTime(188, time)
    body.frequency.exponentialRampToValueAtTime(150, time + 0.08)
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(0.06 * accent, time)
    bg.gain.exponentialRampToValueAtTime(0.0004, time + 0.09)
    body.connect(bg)
    bg.connect(this.musicBus!)
    body.start(time)
    body.stop(time + 0.1)
  }

  private hat(time: number, gain: number, open: boolean, pan: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(open ? 0.24 : 0.055)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7800
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, time)
    env.gain.exponentialRampToValueAtTime(0.0004, time + (open ? 0.2 : 0.045))
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    src.connect(hp)
    hp.connect(env)
    env.connect(panner)
    panner.connect(this.musicBus!)
    src.start(time)
  }

  /* ---------------- 音效 ---------------- */

  sfx(name: 'click' | 'confirm' | 'error' | 'pop' | 'applause' | 'whoosh' | 'heartbeat' | 'chime' | 'coin') {
    if (!this.ctx || !this.sfxBus) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.005
    const out = this.sfxBus

    const tone = (freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) => {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.setValueAtTime(freq, t)
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(gain, t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur)
      osc.connect(g)
      g.connect(out)
      if (this.reverbSend) g.connect(this.reverbSend)
      osc.start(t)
      osc.stop(t + dur + 0.05)
      return osc
    }

    switch (name) {
      case 'click':
        tone(880, 0.06, 0.09, 'triangle')
        break
      case 'confirm':
        tone(660, 0.1, 0.11, 'triangle')
        setTimeout(() => tone(990, 0.14, 0.09, 'triangle'), 70)
        break
      case 'error':
        tone(220, 0.16, 0.13, 'square', 150)
        break
      case 'pop':
        tone(520, 0.07, 0.1, 'sine', 900)
        break
      case 'coin':
        tone(1180, 0.07, 0.09, 'square')
        setTimeout(() => tone(1560, 0.12, 0.07, 'square'), 55)
        break
      case 'chime':
        tone(1320, 0.5, 0.07, 'sine')
        tone(1980, 0.45, 0.04, 'sine')
        break
      case 'whoosh': {
        const src = ctx.createBufferSource()
        src.buffer = this.noiseBuffer(0.6)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.setValueAtTime(300, t)
        bp.frequency.exponentialRampToValueAtTime(4200, t + 0.5)
        bp.Q.value = 1.2
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.16, t + 0.08)
        g.gain.exponentialRampToValueAtTime(0.0005, t + 0.6)
        src.connect(bp)
        bp.connect(g)
        g.connect(out)
        src.start(t)
        break
      }
      case 'heartbeat':
        tone(58, 0.18, 0.3, 'sine')
        setTimeout(() => tone(52, 0.22, 0.22, 'sine'), 200)
        break
      case 'applause': {
        const src = ctx.createBufferSource()
        src.buffer = this.noiseBuffer(2.4)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 2400
        bp.Q.value = 0.5
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.14, t + 0.35)
        g.gain.setValueAtTime(0.14, t + 1.2)
        g.gain.exponentialRampToValueAtTime(0.0005, t + 2.4)
        src.connect(bp)
        bp.connect(g)
        g.connect(out)
        if (this.reverbSend) g.connect(this.reverbSend)
        src.start(t)
        break
      }
    }
  }
}

export const audio = new AudioEngine()

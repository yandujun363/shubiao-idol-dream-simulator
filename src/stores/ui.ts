import { ref } from 'vue'
import { audio } from '../audio/engine'

/** 全局音频开关（多个入口共享） */
export const audioOn = ref(true)

export function setAudioOn(v: boolean) {
  audioOn.value = v
  audio.setEnabled(v)
}

export function toggleAudio() {
  setAudioOn(!audioOn.value)
}

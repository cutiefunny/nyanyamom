// Web Audio API를 활용한 가벼운 신디사이저 효과음 관리자
let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

// 사용자 첫 인터랙션 시 오디오 컨텍스트 활성화
export function initAudio() {
  getAudioContext()
}

// 메트로놈 비트 사운드 (강박 / 약박)
export function playBeatSound(isStrong = false) {
  const ctx = getAudioContext()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  const freq = isStrong ? 880 : 440 // A5 or A4
  osc.frequency.setValueAtTime(freq, ctx.currentTime)

  const vol = isStrong ? 0.12 : 0.05
  gain.gain.setValueAtTime(vol, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start()
  osc.stop(ctx.currentTime + 0.08)
}

// 스페이스바 판정 타격음
export function playHitSound(judgment) {
  const ctx = getAudioContext()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  let freq = 523.25 // C5
  let duration = 0.15

  if (judgment === 'PERFECT') {
    freq = 659.25 // E5
    osc.type = 'triangle'
    duration = 0.18
  } else if (judgment === 'GREAT') {
    freq = 587.33 // D5
    osc.type = 'sine'
    duration = 0.15
  } else {
    freq = 440 // A4
    osc.type = 'sine'
    duration = 0.12
  }

  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(freq * 1.3, ctx.currentTime + duration * 0.7)

  gain.gain.setValueAtTime(0.2, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start()
  osc.stop(ctx.currentTime + duration)
}

// 고양이 냠냠/야옹 소리
export function playMeowSound(isSpecial = false) {
  const ctx = getAudioContext()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  const baseFreq = isSpecial ? 600 : 750
  
  // 야옹 피치 벤딩
  osc.frequency.setValueAtTime(baseFreq, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(baseFreq * 1.35, ctx.currentTime + 0.12)
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, ctx.currentTime + 0.28)

  gain.gain.setValueAtTime(0.01, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(isSpecial ? 0.18 : 0.14, ctx.currentTime + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start()
  osc.stop(ctx.currentTime + 0.3)
}

// MISS 둔탁한 소리
export function playMissSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(160, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.18)

  gain.gain.setValueAtTime(0.12, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start()
  osc.stop(ctx.currentTime + 0.18)
}

// 사료 충전 소리
export function playRefillSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(400, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15)

  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start()
  osc.stop(ctx.currentTime + 0.15)
}

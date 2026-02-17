/**
 * TMR (Targeted Memory Reactivation) Utilities
 * Client-side implementation for study sessions and sleep reactivation
 */

export interface TMRConfig {
  cueFile?: string
  pinkNoiseFile?: string
  studyDurationMinutes: number
  cueIntervalSeconds: number
  studyVolume: number
  sleepOnsetDelayMinutes: number
  sleepCueIntervalSeconds: number
  cuesPerWindow: number
  sleepVolume: number
  usePinkNoise: boolean
  pinkNoiseVolume: number
}

export interface StudySession {
  start: string
  end: string
  durationMinutes: number
  cuesPlayed: number
  cueIntervalSeconds: number
  interrupted?: boolean
}

export interface SleepSession {
  start: string
  end: string
  durationMinutes: number
  totalCues: number
  cycles: number
}

export const DEFAULT_CONFIG: TMRConfig = {
  studyDurationMinutes: 60,
  cueIntervalSeconds: 60,
  studyVolume: 0.7,
  sleepOnsetDelayMinutes: 15, // Typical 10-15 min sleep latency
  sleepCueIntervalSeconds: 10,
  cuesPerWindow: 30,
  sleepVolume: 0.2,
  usePinkNoise: false,
  pinkNoiseVolume: 0.1,
}

/**
 * Generate TMR cue sound using Web Audio API
 */
export async function generateTMRCue(
  duration: number = 1.5,
  frequency: number = 440,
  sampleRate: number = 44100
): Promise<AudioBuffer> {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const audioContext = new Ctx!()
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate)
  const data = buffer.getChannelData(0)

  // Generate sine wave with fade in/out
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate
    const fadeSamples = 0.1 * sampleRate // 100ms fade
    let envelope = 1

    if (i < fadeSamples) {
      envelope = i / fadeSamples
    } else if (i >= data.length - fadeSamples) {
      envelope = (data.length - i) / fadeSamples
    }

    data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.5
  }

  return buffer
}

/**
 * Generate pink noise using Web Audio API
 */
export async function generatePinkNoise(
  duration: number = 300,
  sampleRate: number = 44100
): Promise<AudioBuffer> {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const audioContext = new Ctx!()
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate)
  const data = buffer.getChannelData(0)

  // Generate pink noise (simplified 1/f filter)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  const white = new Float32Array(data.length)

  for (let i = 0; i < white.length; i++) {
    white[i] = Math.random() * 2 - 1
  }

  // Apply pink noise filter
  for (let i = 0; i < data.length; i++) {
    const whiteValue = white[i]!
    b0 = 0.99886 * b0 + whiteValue * 0.0555179
    b1 = 0.99332 * b1 + whiteValue * 0.0750759
    b2 = 0.96900 * b2 + whiteValue * 0.1538520
    b3 = 0.86650 * b3 + whiteValue * 0.3104856
    b4 = 0.55000 * b4 + whiteValue * 0.5329522
    b5 = -0.7616 * b5 - whiteValue * 0.0168980
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + whiteValue * 0.5362
    data[i]! *= 0.11 // Normalize
    b6 = whiteValue * 0.115926
  }

  // Apply fade in/out
  const fadeSamples = 2 * sampleRate // 2 second fade
  for (let i = 0; i < fadeSamples && i < data.length; i++) {
    data[i]! *= i / fadeSamples
  }
  for (let i = Math.max(0, data.length - fadeSamples); i < data.length; i++) {
    data[i]! *= (data.length - i) / fadeSamples
  }

  return buffer
}

/**
 * Play audio buffer with volume control
 */
export function playAudioBuffer(
  buffer: AudioBuffer,
  volume: number = 1.0,
  audioContext?: AudioContext
): AudioBufferSourceNode {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const ctx = audioContext || new Ctx!()
  const source = ctx.createBufferSource()
  const gainNode = ctx.createGain()

  gainNode.gain.value = volume
  source.buffer = buffer
  source.connect(gainNode)
  gainNode.connect(ctx.destination)
  source.start()

  return source
}

/**
 * Calculate sleep reactivation windows based on personalized sleep cycle data
 *
 * Based on Apple Watch data analysis:
 * - Typical cycles: ~75-85 min, first cycle is longer (~90 min)
 * - Deep sleep concentrated in first 2-3 hours
 */
export function calculateSleepWindows(sleepOnsetDelayMinutes: number = 0) {
  const windows = []

  // Personalized sleep cycle windows based on Apple Watch data
  // Cycle 1: 0-90 min, target 50-85 min (peak deep sleep, cushioned)
  windows.push({
    startMinutes: sleepOnsetDelayMinutes + 50,
    endMinutes: sleepOnsetDelayMinutes + 85,
    cycle: 1,
    description: 'Peak deep sleep - first cycle (90 min, cushioned)',
  })

  // Cycle 2: 90-170 min, target 110-155 min (some deep sleep, cushioned)
  windows.push({
    startMinutes: sleepOnsetDelayMinutes + 110,
    endMinutes: sleepOnsetDelayMinutes + 155,
    cycle: 2,
    description: 'Moderate deep sleep - second cycle (80 min, cushioned)',
  })

  // Cycle 3: 170-245 min, target 190-230 min (light sleep, cushioned)
  windows.push({
    startMinutes: sleepOnsetDelayMinutes + 190,
    endMinutes: sleepOnsetDelayMinutes + 230,
    cycle: 3,
    description: 'Light sleep - third cycle (75 min)',
  })

  // Cycle 4: 245-320 min, target 260-300 min (very light, cushioned)
  windows.push({
    startMinutes: sleepOnsetDelayMinutes + 260,
    endMinutes: sleepOnsetDelayMinutes + 300,
    cycle: 4,
    description: 'Very light sleep - fourth cycle (75 min, cushioned)',
  })

  return windows
}

const TMR_USER_ID_KEY = 'tmr_user_id'

function genTmrUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getOrCreateTmrUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(TMR_USER_ID_KEY)
  if (!id) {
    id = genTmrUuid()
    localStorage.setItem(TMR_USER_ID_KEY, id)
  }
  return id
}

export async function syncStudySessionToServer(session: StudySession): Promise<void> {
  if (typeof window === 'undefined') return
  const userId = getOrCreateTmrUserId()
  await fetch('/api/tmr/study', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      session: {
        start: session.start,
        end: session.end,
        durationMinutes: session.durationMinutes,
        cuesPlayed: session.cuesPlayed,
        cueIntervalSeconds: session.cueIntervalSeconds,
        interrupted: session.interrupted,
      },
    }),
  })
}

export async function syncSleepSessionToServer(session: SleepSession): Promise<void> {
  if (typeof window === 'undefined') return
  const userId = getOrCreateTmrUserId()
  await fetch('/api/tmr/sleep', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      session: {
        start: session.start,
        end: session.end,
        durationMinutes: session.durationMinutes,
        totalCues: session.totalCues,
        cycles: session.cycles,
      },
    }),
  })
}

/**
 * Load config from localStorage
 */
export function loadConfig(): TMRConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG

  const stored = localStorage.getItem('tmr_config')
  if (stored) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) }
    } catch {
      return DEFAULT_CONFIG
    }
  }
  return DEFAULT_CONFIG
}

/**
 * Save config to localStorage
 */
export function saveConfig(config: TMRConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('tmr_config', JSON.stringify(config))
}

/**
 * Load study sessions from localStorage
 */
export function loadStudySessions(): StudySession[] {
  if (typeof window === 'undefined') return []

  const stored = localStorage.getItem('tmr_study_sessions')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  return []
}

/**
 * Save study session to localStorage
 */
export function saveStudySession(session: StudySession): void {
  if (typeof window === 'undefined') return

  const sessions = loadStudySessions()
  sessions.push(session)
  localStorage.setItem('tmr_study_sessions', JSON.stringify(sessions))
}

/**
 * Load sleep sessions from localStorage
 */
export function loadSleepSessions(): SleepSession[] {
  if (typeof window === 'undefined') return []

  const stored = localStorage.getItem('tmr_sleep_sessions')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  return []
}

/**
 * Save sleep session to localStorage
 */
export function saveSleepSession(session: SleepSession): void {
  if (typeof window === 'undefined') return

  const sessions = loadSleepSessions()
  sessions.push(session)
  localStorage.setItem('tmr_sleep_sessions', JSON.stringify(sessions))
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  loadConfig,
  saveConfig,
  saveSleepSession,
  syncSleepSessionToServer,
  generateTMRCue,
  generatePinkNoise,
  playAudioBuffer,
  calculateSleepWindows,
  type TMRConfig,
  type SleepSession,
} from '@/lib/tmr'

export default function TMRSleepReactivation({ onBack }: { onBack: () => void }) {
  const [config, setConfig] = useState<TMRConfig>(loadConfig())
  const [isRunning, setIsRunning] = useState(false)
  const [delay, setDelay] = useState(config.sleepOnsetDelayMinutes)
  const [elapsed, setElapsed] = useState(0)
  const [currentCycle, setCurrentCycle] = useState(0)
  const [cuesPlayed, setCuesPlayed] = useState(0)
  const [status, setStatus] = useState<string>('Ready')
  const [sessionStart, setSessionStart] = useState<Date | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const cueBufferRef = useRef<AudioBuffer | null>(null)
  const pinkNoiseBufferRef = useRef<AudioBuffer | null>(null)
  const pinkNoiseSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const windowsRef = useRef<ReturnType<typeof calculateSleepWindows>>([])
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])
  const cueIntervalRefs = useRef<NodeJS.Timeout[]>([])

  // Initialize audio context and generate sounds
  useEffect(() => {
    const initAudio = async () => {
      try {
        const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        audioContextRef.current = new Ctx!()
        cueBufferRef.current = await generateTMRCue()
        if (config.usePinkNoise) {
          pinkNoiseBufferRef.current = await generatePinkNoise(300) // 5 minutes, will loop
        }
      } catch (error) {
        console.error('Failed to initialize audio:', error)
      }
    }
    initAudio()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timeoutRefs.current.forEach(clearTimeout)
      cueIntervalRefs.current.forEach(clearInterval)
      timeoutRefs.current = []
      cueIntervalRefs.current = []
      if (pinkNoiseSourceRef.current) {
        pinkNoiseSourceRef.current.stop()
      }
    }
  }, [config.usePinkNoise])

  const playCue = useCallback(() => {
    if (cueBufferRef.current && audioContextRef.current) {
      playAudioBuffer(cueBufferRef.current, config.sleepVolume, audioContextRef.current)
      setCuesPlayed((prev) => prev + 1)
    }
  }, [config.sleepVolume])

  const startPinkNoise = useCallback(() => {
    if (!config.usePinkNoise || !pinkNoiseBufferRef.current || !audioContextRef.current) return

    const source = audioContextRef.current.createBufferSource()
    const gainNode = audioContextRef.current.createGain()
    gainNode.gain.value = config.pinkNoiseVolume
    source.buffer = pinkNoiseBufferRef.current
    source.loop = true
    source.connect(gainNode)
    gainNode.connect(audioContextRef.current.destination)
    source.start()
    pinkNoiseSourceRef.current = source
  }, [config.usePinkNoise, config.pinkNoiseVolume])

  const stopPinkNoise = useCallback(() => {
    if (pinkNoiseSourceRef.current) {
      pinkNoiseSourceRef.current.stop()
      pinkNoiseSourceRef.current = null
    }
  }, [])

  const startReactivation = useCallback(() => {
    if (!audioContextRef.current || !cueBufferRef.current) {
      alert('Audio not initialized. Please wait a moment and try again.')
      return
    }

    setIsRunning(true)
    setSessionStart(new Date())
    setElapsed(0)
    setCuesPlayed(0)
    setCurrentCycle(0)
    startTimeRef.current = Date.now()

    timeoutRefs.current.forEach(clearTimeout)
    cueIntervalRefs.current.forEach(clearInterval)
    timeoutRefs.current = []
    cueIntervalRefs.current = []

    // Calculate windows
    windowsRef.current = calculateSleepWindows(delay)

    // Start pink noise if enabled
    if (config.usePinkNoise) {
      startPinkNoise()
    }

    // Timer for elapsed time
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsedMinutes = Math.floor((Date.now() - startTimeRef.current) / 60000)
        setElapsed(elapsedMinutes)

        // Check which window we're in
        const currentWindow = windowsRef.current.find(
          (w) => elapsedMinutes >= w.startMinutes && elapsedMinutes < w.endMinutes
        )

        if (currentWindow) {
          setCurrentCycle(currentWindow.cycle)
          setStatus(`Cycle ${currentWindow.cycle} - Reactivating...`)
        } else if (elapsedMinutes < delay) {
          const remaining = delay - elapsedMinutes
          setStatus(`Waiting for deep sleep... ${remaining} min remaining`)
        } else {
          const nextWindow = windowsRef.current.find((w) => elapsedMinutes < w.startMinutes)
          if (nextWindow) {
            const remaining = nextWindow.startMinutes - elapsedMinutes
            setStatus(`Waiting for cycle ${nextWindow.cycle}... ${remaining} min remaining`)
          } else {
            setStatus('Session complete')
          }
        }
      }
    }, 60000) // Update every minute

    // Process windows
    const processWindows = () => {
      windowsRef.current.forEach((window) => {
        const windowStartMs = window.startMinutes * 60 * 1000
        const windowEndMs = window.endMinutes * 60 * 1000

        const timeoutId = setTimeout(() => {
          if (!startTimeRef.current) return

          setCurrentCycle(window.cycle)
          setStatus(`Cycle ${window.cycle} - Reactivating...`)

          // Play cues during this window
          let cuesInWindow = 0
          const cueInterval = setInterval(() => {
            if (!startTimeRef.current) {
              clearInterval(cueInterval)
              return
            }

            const elapsedMs = Date.now() - startTimeRef.current
            const windowElapsed = elapsedMs - windowStartMs
            const windowDuration = windowEndMs - windowStartMs

            if (windowElapsed >= windowDuration || cuesInWindow >= config.cuesPerWindow) {
              clearInterval(cueInterval)
              return
            }

            playCue()
            cuesInWindow++
          }, config.sleepCueIntervalSeconds * 1000)
          cueIntervalRefs.current.push(cueInterval)
        }, windowStartMs)
        timeoutRefs.current.push(timeoutId)
      })
    }

    processWindows()
  }, [delay, config.sleepCueIntervalSeconds, config.cuesPerWindow, config.usePinkNoise, playCue, startPinkNoise])

  const stopReactivation = useCallback(() => {
    setIsRunning(false)
    stopPinkNoise()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    timeoutRefs.current.forEach(clearTimeout)
    cueIntervalRefs.current.forEach(clearInterval)
    timeoutRefs.current = []
    cueIntervalRefs.current = []

    // Save session log
    if (sessionStart && startTimeRef.current) {
      const sessionEnd = new Date()
      const durationMinutes = (sessionEnd.getTime() - sessionStart.getTime()) / 60000

      const session: SleepSession = {
        start: sessionStart.toISOString(),
        end: sessionEnd.toISOString(),
        durationMinutes,
        totalCues: cuesPlayed,
        cycles: windowsRef.current.length,
      }

      saveSleepSession(session)
      void syncSleepSessionToServer(session)
    }

    setSessionStart(null)
    startTimeRef.current = null
    setStatus('Stopped')
  }, [sessionStart, cuesPlayed, stopPinkNoise])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="text-white hover:text-gray-300 text-2xl font-bold"
            aria-label="Back"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold text-white">TMR Sleep Reactivation</h1>
          <div className="w-16" /> {/* Spacer */}
        </div>

        {/* Info - Personalized */}
        <div className="bg-blue-500/20 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/40 mb-6">
          <h3 className="text-xl font-bold text-white mb-2 text-center">🎯 Personalized for Your Sleep</h3>
          <p className="text-blue-200 text-center text-sm">
            Based on your Apple Watch data: First cycle is longer (~90 min), later cycles are ~75-85 min.
            Deep sleep is concentrated in the first 2-3 hours. Windows include cushion; latency ~10-15 min.
          </p>
        </div>

        {/* Controls */}
        {!isRunning ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 mb-6">
            <h2 className="text-2xl font-bold text-white mb-6">Configure Sleep Reactivation</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-white mb-2">
                  Sleep Onset Delay: {delay} minutes
                </label>
                <p className="text-gray-400 text-sm mb-2">
                  Typical sleep latency is 10-15 minutes. Start when you get into bed.
                </p>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="5"
                  value={delay}
                  onChange={(e) => {
                    const newDelay = parseInt(e.target.value)
                    setDelay(newDelay)
                    const newConfig = { ...config, sleepOnsetDelayMinutes: newDelay }
                    setConfig(newConfig)
                    saveConfig(newConfig)
                  }}
                  className="w-full"
                  disabled={isRunning}
                />
              </div>

              <div>
                <label className="block text-white mb-2">
                  Cue Interval: {config.sleepCueIntervalSeconds} seconds
                </label>
                <input
                  type="range"
                  min="5"
                  max="20"
                  step="5"
                  value={config.sleepCueIntervalSeconds}
                  onChange={(e) => {
                    const newConfig = { ...config, sleepCueIntervalSeconds: parseInt(e.target.value) }
                    setConfig(newConfig)
                    saveConfig(newConfig)
                  }}
                  className="w-full"
                  disabled={isRunning}
                />
              </div>

              <div>
                <label className="block text-white mb-2">
                  Sleep Volume: {Math.round(config.sleepVolume * 100)}%
                </label>
                <p className="text-gray-400 text-sm mb-2">
                  Keep low (10-30%) to avoid waking up
                </p>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={config.sleepVolume * 100}
                  onChange={(e) => {
                    const newConfig = { ...config, sleepVolume: parseInt(e.target.value) / 100 }
                    setConfig(newConfig)
                    saveConfig(newConfig)
                  }}
                  className="w-full"
                  disabled={isRunning}
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="pinkNoise"
                  checked={config.usePinkNoise}
                  onChange={(e) => {
                    const newConfig = { ...config, usePinkNoise: e.target.checked }
                    setConfig(newConfig)
                    saveConfig(newConfig)
                  }}
                  className="w-5 h-5"
                  disabled={isRunning}
                />
                <label htmlFor="pinkNoise" className="text-white">
                  Use pink noise background (enhances slow-wave activity)
                </label>
              </div>
            </div>

            <button
              onClick={startReactivation}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-bold transition-colors"
            >
              Start Sleep Reactivation
            </button>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 mb-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Reactivation Active</h2>
              <div className="text-4xl font-mono text-white mb-4">{elapsed} min</div>
              <div className="text-gray-300 mb-2">Status: {status}</div>
              {currentCycle > 0 && (
                <div className="text-gray-300 mb-2">Current Cycle: {currentCycle}</div>
              )}
              <div className="text-gray-300 mb-4">Cues Played: {cuesPlayed}</div>
              <button
                onClick={stopReactivation}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
              >
                Stop Reactivation
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-3">Your Personalized Sleep Schedule</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>🌙 Cycle 1 (50-85 min):</span>
              <span className="text-blue-300 font-semibold">Peak deep sleep</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>🌙 Cycle 2 (110-155 min):</span>
              <span className="text-blue-300">Moderate deep sleep</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>🌙 Cycle 3 (190-230 min):</span>
              <span className="text-gray-400">Light sleep</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>🌙 Cycle 4 (260-300 min):</span>
              <span className="text-gray-400">Very light sleep</span>
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-4">
            Based on your Apple Watch data: First cycle is longer (~90 min), later cycles are ~75-85 min.
            Sleep latency is typically 10-15 minutes. Windows include cushion for drift.
          </p>
        </div>
      </div>
    </div>
  )
}

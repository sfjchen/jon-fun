'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  loadConfig,
  saveConfig,
  saveStudySession,
  syncStudySessionToServer,
  generateTMRCue,
  playAudioBuffer,
  type TMRConfig,
  type StudySession,
} from '@/lib/tmr'

export default function TMRStudySession({ onBack }: { onBack: () => void }) {
  const [config, setConfig] = useState<TMRConfig>(loadConfig())
  const [isRunning, setIsRunning] = useState(false)
  const [duration, setDuration] = useState(config.studyDurationMinutes)
  const [elapsed, setElapsed] = useState(0)
  const [cuesPlayed, setCuesPlayed] = useState(0)
  const [sessionStart, setSessionStart] = useState<Date | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const cueBufferRef = useRef<AudioBuffer | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Initialize audio context and generate cue
  useEffect(() => {
    const initAudio = async () => {
      try {
        const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        audioContextRef.current = new Ctx!()
        cueBufferRef.current = await generateTMRCue()
      } catch (error) {
        console.error('Failed to initialize audio:', error)
      }
    }
    initAudio()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const playCue = useCallback(() => {
    if (cueBufferRef.current && audioContextRef.current) {
      playAudioBuffer(cueBufferRef.current, config.studyVolume, audioContextRef.current)
      setCuesPlayed((prev) => prev + 1)
    }
  }, [config.studyVolume])

  const stopSession = useCallback((interrupted: boolean) => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Save session log
    if (sessionStart) {
      const sessionEnd = new Date()
      const durationMinutes = (sessionEnd.getTime() - sessionStart.getTime()) / 60000

      const session: StudySession = {
        start: sessionStart.toISOString(),
        end: sessionEnd.toISOString(),
        durationMinutes,
        cuesPlayed,
        cueIntervalSeconds: config.cueIntervalSeconds,
        interrupted,
      }

      saveStudySession(session)
      void syncStudySessionToServer(session)
    }

    setSessionStart(null)
    startTimeRef.current = null
  }, [sessionStart, cuesPlayed, config.cueIntervalSeconds])

  const startSession = useCallback(() => {
    if (!audioContextRef.current || !cueBufferRef.current) {
      alert('Audio not initialized. Please wait a moment and try again.')
      return
    }

    setIsRunning(true)
    setSessionStart(new Date())
    setElapsed(0)
    setCuesPlayed(0)
    startTimeRef.current = Date.now()

    playCue()
    intervalRef.current = setInterval(() => playCue(), config.cueIntervalSeconds * 1000)
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setElapsed(elapsedSeconds)
        if (elapsedSeconds >= duration * 60) stopSession(false)
      }
    }, 1000)
  }, [duration, config.cueIntervalSeconds, playCue, stopSession])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const remainingSeconds = duration * 60 - elapsed
  const remainingTime = remainingSeconds > 0 ? formatTime(remainingSeconds) : '00:00'

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
          <h1 className="text-4xl font-bold text-white">TMR Study Session</h1>
          <div className="w-16" /> {/* Spacer */}
        </div>

        {/* Session Controls */}
        {!isRunning ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 mb-6">
            <h2 className="text-2xl font-bold text-white mb-6">Start Study Session</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-white mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 60))}
                  min="1"
                  max="120"
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  disabled={isRunning}
                />
              </div>

              <div>
                <label className="block text-white mb-2">
                  Cue Interval: {config.cueIntervalSeconds} seconds
                </label>
                <input
                  type="range"
                  min="30"
                  max="120"
                  step="10"
                  value={config.cueIntervalSeconds}
                  onChange={(e) => {
                    const newConfig = { ...config, cueIntervalSeconds: parseInt(e.target.value) }
                    setConfig(newConfig)
                    saveConfig(newConfig)
                  }}
                  className="w-full"
                  disabled={isRunning}
                />
              </div>

              <div>
                <label className="block text-white mb-2">
                  Volume: {Math.round(config.studyVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={config.studyVolume * 100}
                  onChange={(e) => {
                    const newConfig = { ...config, studyVolume: parseInt(e.target.value) / 100 }
                    setConfig(newConfig)
                    saveConfig(newConfig)
                  }}
                  className="w-full"
                  disabled={isRunning}
                />
              </div>
            </div>

            <button
              onClick={startSession}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-bold transition-colors"
            >
              Start Study Session
            </button>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 mb-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Session Active</h2>
              <div className="text-6xl font-mono text-white mb-4">{remainingTime}</div>
              <div className="text-gray-300 mb-4">
                Elapsed: {formatTime(elapsed)} | Cues: {cuesPlayed}
              </div>
              <button
                onClick={() => stopSession(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
              >
                Stop Session
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-3">How TMR Works</h3>
          <ul className="text-gray-300 space-y-2 text-sm">
            <li>• TMR cues play periodically during your study session</li>
            <li>• These sounds tag the material you are learning</li>
            <li>• Later, replay these cues during sleep to reinforce memories</li>
            <li>• Focus intensely on your material when you hear each cue</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

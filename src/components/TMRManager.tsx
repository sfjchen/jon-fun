'use client'

import { useState, useEffect } from 'react'
import TMRStudySession from './TMRStudySession'
import TMRSleepReactivation from './TMRSleepReactivation'
import {
  loadStudySessions,
  loadSleepSessions,
  type StudySession,
  type SleepSession,
} from '@/lib/tmr'

type View = 'menu' | 'study' | 'sleep' | 'history'

export default function TMRManager() {
  const [view, setView] = useState<View>('menu')
  const [studySessions, setStudySessions] = useState<StudySession[]>([])
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([])

  useEffect(() => {
    setStudySessions(loadStudySessions())
    setSleepSessions(loadSleepSessions())
  }, [])

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (view === 'study') {
    return <TMRStudySession onBack={() => setView('menu')} />
  }

  if (view === 'sleep') {
    return <TMRSleepReactivation onBack={() => setView('menu')} />
  }

  if (view === 'history') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => setView('menu')}
              className="text-white hover:text-gray-300 text-2xl font-bold"
              aria-label="Back"
            >
              ← Back
            </button>
            <h1 className="text-4xl font-bold text-white">Session History</h1>
            <div className="w-16" />
          </div>

          {/* Study Sessions */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              Study Sessions ({studySessions.length})
            </h2>
            {studySessions.length === 0 ? (
              <p className="text-gray-300">No study sessions yet.</p>
            ) : (
              <div className="space-y-3">
                {studySessions.slice(-10).reverse().map((session, index) => (
                  <div
                    key={index}
                    className="bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-semibold">
                          {formatDate(session.start)}
                        </div>
                        <div className="text-gray-300 text-sm">
                          Duration: {session.durationMinutes.toFixed(1)} min |{' '}
                          {session.cuesPlayed} cues
                          {session.interrupted && ' (interrupted)'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sleep Sessions */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">
              Sleep Reactivation Sessions ({sleepSessions.length})
            </h2>
            {sleepSessions.length === 0 ? (
              <p className="text-gray-300">No sleep reactivation sessions yet.</p>
            ) : (
              <div className="space-y-3">
                {sleepSessions.slice(-10).reverse().map((session, index) => (
                  <div
                    key={index}
                    className="bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-semibold">
                          {formatDate(session.start)}
                        </div>
                        <div className="text-gray-300 text-sm">
                          Duration: {session.durationMinutes.toFixed(1)} min |{' '}
                          {session.totalCues} cues | {session.cycles} cycles
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">🧠 TMR System</h1>
          <p className="text-xl text-gray-300">
            Targeted Memory Reactivation for Enhanced Learning
          </p>
        </header>

        {/* Quick Start */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Run on Web</h2>
          <p className="text-gray-300 text-sm">
            Use this page for both study and pre-sleep sessions. Start a study session now,
            then return before bed to run sleep reactivation. Keep this tab open and allow audio.
          </p>
        </div>

        {/* Main Menu */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => setView('study')}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:scale-105"
          >
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-bold text-white mb-2">Study Session</h2>
            <p className="text-gray-300">
              Start a focused study session with TMR cues to tag your memories
            </p>
          </button>

          <button
            onClick={() => setView('sleep')}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:scale-105"
          >
            <div className="text-6xl mb-4">🌙</div>
            <h2 className="text-2xl font-bold text-white mb-2">Sleep Reactivation</h2>
            <p className="text-gray-300">
              Schedule TMR cues during optimal sleep stages for memory consolidation
            </p>
          </button>

          <button
            onClick={() => setView('history')}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:scale-105"
          >
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-white mb-2">Session History</h2>
            <p className="text-gray-300">
              View your study and sleep reactivation session logs
            </p>
          </button>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <div className="text-6xl mb-4">ℹ️</div>
            <h2 className="text-2xl font-bold text-white mb-2">About TMR</h2>
            <p className="text-gray-300 text-sm">
              Targeted Memory Reactivation uses sound cues during study and sleep to enhance
              memory consolidation. Research shows it can improve learning by 10-20%.
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-bold text-white">{studySessions.length}</div>
              <div className="text-gray-300">Study Sessions</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">{sleepSessions.length}</div>
              <div className="text-gray-300">Sleep Sessions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import Image from 'next/image'
import { useState, useSyncExternalStore } from 'react'
import TMRStudySession from './TMRStudySession'
import TMRSleepReactivation from './TMRSleepReactivation'
import { loadStudySessions, loadSleepSessions, type StudySession, type SleepSession } from '@/lib/tmr'

type View = 'menu' | 'study' | 'sleep' | 'history'

export default function TMRManager() {
  const inNotebook = true
  const [view, setView] = useState<View>('menu')
  const [studySessions, setStudySessions] = useState<StudySession[]>([])
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([])

  /* Loads saved sessions once on the client, after hydration renders the empty lists. */
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const [loaded, setLoaded] = useState(false)
  if (hydrated && !loaded) {
    setLoaded(true)
    setStudySessions(loadStudySessions())
    setSleepSessions(loadSleepSessions())
  }

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
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => setView('menu')}
            className="text-2xl font-bold hover:opacity-80"
            style={{ color: 'var(--ink-accent)' }}
            aria-label="Back"
          >
            ← Back
          </button>
          <h1 className="font-lora text-4xl font-bold" style={{ color: 'var(--ink-text)' }}>
            Session History
          </h1>
          <div className="w-16" />
        </div>

        {/* Study Sessions */}
        <div
          className={`rounded-lg border shadow-sm ${inNotebook ? 'mb-[30px] p-[30px]' : 'mb-6 p-6'}`}
          style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <h2
            className={`font-lora text-2xl font-bold ${inNotebook ? 'mb-[30px]' : 'mb-4'}`}
            style={{ color: 'var(--ink-text)' }}
          >
            Study Sessions ({studySessions.length})
          </h2>
          {studySessions.length === 0 ? (
            <p style={{ color: 'var(--ink-muted)' }}>No study sessions yet.</p>
          ) : (
            <div className={inNotebook ? 'space-y-[30px]' : 'space-y-3'}>
              {studySessions
                .slice(-10)
                .reverse()
                .map((session, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border ${inNotebook ? 'p-[30px]' : 'p-4'}`}
                    style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold" style={{ color: 'var(--ink-text)' }}>
                          {formatDate(session.start)}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                          Duration: {session.durationMinutes.toFixed(1)} min | {session.cuesPlayed} cues
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
        <div
          className={`rounded-lg border shadow-sm ${inNotebook ? 'p-[30px]' : 'p-6'}`}
          style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <h2
            className={`font-lora text-2xl font-bold ${inNotebook ? 'mb-[30px]' : 'mb-4'}`}
            style={{ color: 'var(--ink-text)' }}
          >
            Sleep Reactivation Sessions ({sleepSessions.length})
          </h2>
          {sleepSessions.length === 0 ? (
            <p style={{ color: 'var(--ink-muted)' }}>No sleep reactivation sessions yet.</p>
          ) : (
            <div className={inNotebook ? 'space-y-[30px]' : 'space-y-3'}>
              {sleepSessions
                .slice(-10)
                .reverse()
                .map((session, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border ${inNotebook ? 'p-[30px]' : 'p-4'}`}
                    style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold" style={{ color: 'var(--ink-text)' }}>
                          {formatDate(session.start)}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                          Duration: {session.durationMinutes.toFixed(1)} min | {session.totalCues} cues |{' '}
                          {session.cycles} cycles
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <header className="mb-12 text-center">
        <h1
          className="mb-4 flex items-center justify-center gap-3 font-lora text-5xl font-bold"
          style={{ color: 'var(--ink-text)' }}
        >
          <Image
            src={inNotebook ? '/doodles/notebook/tmr.svg' : '/doodles/tmr.svg'}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12"
          />
          Focus Chimes
        </h1>
        <p className="text-xl" style={{ color: 'var(--ink-muted)' }}>
          Recurring background chimes to stay on track and keep a sense of time
        </p>
      </header>

      {/* Main Menu */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${inNotebook ? 'mb-[30px] [grid-auto-rows:240px] gap-[30px]' : 'mb-8 gap-6'}`}
      >
        <button
          onClick={() => setView('study')}
          className={`flex h-full min-h-0 flex-col rounded-lg border text-left shadow-sm transition-all duration-200 hover:shadow-md ${inNotebook ? 'p-[30px]' : 'p-8'}`}
          style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <Image src="/doodles/study.svg" alt="" width={56} height={56} className="mb-4 h-14 w-14" />
          <h2 className="mb-2 font-lora text-2xl font-bold" style={{ color: 'var(--ink-text)' }}>
            Study Session
          </h2>
          <p style={{ color: 'var(--ink-muted)' }}>Work while a soft chime plays on a set interval</p>
        </button>

        <button
          onClick={() => setView('sleep')}
          className={`flex h-full min-h-0 flex-col rounded-lg border text-left shadow-sm transition-all duration-200 hover:shadow-md ${inNotebook ? 'p-[30px]' : 'p-8'}`}
          style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <Image src="/doodles/sleep.svg" alt="" width={56} height={56} className="mb-4 h-14 w-14" />
          <h2 className="mb-2 font-lora text-2xl font-bold" style={{ color: 'var(--ink-text)' }}>
            Sleep Reactivation
          </h2>
          <p style={{ color: 'var(--ink-muted)' }}>Replay the same chime quietly while you sleep</p>
        </button>

        <button
          onClick={() => setView('history')}
          className={`flex h-full min-h-0 flex-col rounded-lg border text-left shadow-sm transition-all duration-200 hover:shadow-md ${inNotebook ? 'p-[30px]' : 'p-8'}`}
          style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <Image src="/doodles/history.svg" alt="" width={56} height={56} className="mb-4 h-14 w-14" />
          <h2 className="mb-2 font-lora text-2xl font-bold" style={{ color: 'var(--ink-text)' }}>
            Session History
          </h2>
          <p style={{ color: 'var(--ink-muted)' }}>Past study and sleep sessions</p>
        </button>

        <div
          className={`flex h-full min-h-0 flex-col rounded-lg border ${inNotebook ? 'p-[30px]' : 'p-8'}`}
          style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}
        >
          <Image src="/doodles/info.svg" alt="" width={56} height={56} className="mb-4 h-14 w-14" />
          <h2 className="mb-2 font-lora text-2xl font-bold" style={{ color: 'var(--ink-text)' }}>
            How it works
          </h2>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            Based on Targeted Memory Reactivation (TMR): a sound heard while studying, replayed during sleep, may help
            memory.
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div
        className={`rounded-lg border shadow-sm ${inNotebook ? 'p-[30px]' : 'p-6'}`}
        style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
      >
        <h3
          className={`font-lora font-bold ${inNotebook ? 'mb-[30px] text-xl' : 'mb-4 text-xl'}`}
          style={{ color: 'var(--ink-text)' }}
        >
          Quick Stats
        </h3>
        <div className={`grid grid-cols-2 ${inNotebook ? 'gap-[30px]' : 'gap-4'}`}>
          <div>
            <div className="text-3xl font-bold" style={{ color: 'var(--ink-text)' }}>
              {studySessions.length}
            </div>
            <div style={{ color: 'var(--ink-muted)' }}>Study Sessions</div>
          </div>
          <div>
            <div className="text-3xl font-bold" style={{ color: 'var(--ink-text)' }}>
              {sleepSessions.length}
            </div>
            <div style={{ color: 'var(--ink-muted)' }}>Sleep Sessions</div>
          </div>
        </div>
      </div>
    </div>
  )
}

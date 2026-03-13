'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname()
  const inNotebook = !pathname?.startsWith('/theme2')
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => setView('menu')}
            className="text-2xl font-bold hover:opacity-80"
            style={{ color: 'var(--ink-accent)' }}
            aria-label="Back"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold font-lora" style={{ color: 'var(--ink-text)' }}>Session History</h1>
          <div className="w-16" />
        </div>

        {/* Study Sessions */}
        <div className={`rounded-lg border shadow-sm ${inNotebook ? 'p-[30px] mb-[30px]' : 'p-6 mb-6'}`} style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
          <h2 className={`text-2xl font-bold font-lora ${inNotebook ? 'mb-[30px]' : 'mb-4'}`} style={{ color: 'var(--ink-text)' }}>
              Study Sessions ({studySessions.length})
            </h2>
            {studySessions.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)' }}>No study sessions yet.</p>
            ) : (
              <div className={inNotebook ? 'space-y-[30px]' : 'space-y-3'}>
                {studySessions.slice(-10).reverse().map((session, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border ${inNotebook ? 'p-[30px]' : 'p-4'}`}
                    style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold" style={{ color: 'var(--ink-text)' }}>
                          {formatDate(session.start)}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>
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
        <div className={`rounded-lg border shadow-sm ${inNotebook ? 'p-[30px]' : 'p-6'}`} style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
          <h2 className={`text-2xl font-bold font-lora ${inNotebook ? 'mb-[30px]' : 'mb-4'}`} style={{ color: 'var(--ink-text)' }}>
              Sleep Reactivation Sessions ({sleepSessions.length})
            </h2>
            {sleepSessions.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)' }}>No sleep reactivation sessions yet.</p>
            ) : (
              <div className={inNotebook ? 'space-y-[30px]' : 'space-y-3'}>
                {sleepSessions.slice(-10).reverse().map((session, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border ${inNotebook ? 'p-[30px]' : 'p-4'}`}
                    style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold" style={{ color: 'var(--ink-text)' }}>
                          {formatDate(session.start)}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>
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
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <header className="text-center mb-12">
        <h1 className="text-5xl font-bold font-lora mb-4 flex items-center justify-center gap-3" style={{ color: 'var(--ink-text)' }}>
          <Image src={inNotebook ? '/doodles/notebook/tmr.svg' : '/doodles/tmr.svg'} alt="" width={48} height={48} className="h-12 w-12" />
          TMR System
        </h1>
        <p className="text-xl" style={{ color: 'var(--ink-muted)' }}>
            Targeted Memory Reactivation for Enhanced Learning
          </p>
        </header>

      {/* Main Menu */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${inNotebook ? 'gap-[30px] [grid-auto-rows:240px] mb-[30px]' : 'gap-6 mb-8'}`}>
        <button
          onClick={() => setView('study')}
          className={`rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 text-left h-full min-h-0 flex flex-col ${inNotebook ? 'p-[30px]' : 'p-8'}`}
          style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <Image src="/doodles/study.svg" alt="" width={56} height={56} className="h-14 w-14 mb-4" />
          <h2 className="text-2xl font-bold font-lora mb-2" style={{ color: 'var(--ink-text)' }}>Study Session</h2>
          <p style={{ color: 'var(--ink-muted)' }}>
              Start a focused study session with TMR cues to tag your memories
            </p>
          </button>

        <button
          onClick={() => setView('sleep')}
          className={`rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 text-left h-full min-h-0 flex flex-col ${inNotebook ? 'p-[30px]' : 'p-8'}`}
          style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <Image src="/doodles/sleep.svg" alt="" width={56} height={56} className="h-14 w-14 mb-4" />
          <h2 className="text-2xl font-bold font-lora mb-2" style={{ color: 'var(--ink-text)' }}>Sleep Reactivation</h2>
          <p style={{ color: 'var(--ink-muted)' }}>
              Schedule TMR cues during optimal sleep stages for memory consolidation
            </p>
          </button>

        <button
          onClick={() => setView('history')}
          className={`rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 text-left h-full min-h-0 flex flex-col ${inNotebook ? 'p-[30px]' : 'p-8'}`}
          style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        >
          <Image src="/doodles/history.svg" alt="" width={56} height={56} className="h-14 w-14 mb-4" />
          <h2 className="text-2xl font-bold font-lora mb-2" style={{ color: 'var(--ink-text)' }}>Session History</h2>
          <p style={{ color: 'var(--ink-muted)' }}>
              View your study and sleep reactivation session logs
            </p>
          </button>

        <div className={`rounded-lg border h-full min-h-0 flex flex-col ${inNotebook ? 'p-[30px]' : 'p-8'}`} style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}>
          <Image src="/doodles/info.svg" alt="" width={56} height={56} className="h-14 w-14 mb-4" />
          <h2 className="text-2xl font-bold font-lora mb-2" style={{ color: 'var(--ink-text)' }}>About TMR</h2>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              Targeted Memory Reactivation uses sound cues during study and sleep to enhance
              memory consolidation. Research shows it can improve learning by 10-20%.
            </p>
          </div>
        </div>

      {/* Quick Stats */}
      <div className={`rounded-lg border shadow-sm ${inNotebook ? 'p-[30px]' : 'p-6'}`} style={{ backgroundColor: inNotebook ? 'transparent' : 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
        <h3 className={`font-bold font-lora ${inNotebook ? 'text-xl mb-[30px]' : 'text-xl mb-4'}`} style={{ color: 'var(--ink-text)' }}>Quick Stats</h3>
        <div className={`grid grid-cols-2 ${inNotebook ? 'gap-[30px]' : 'gap-4'}`}>
          <div>
            <div className="text-3xl font-bold" style={{ color: 'var(--ink-text)' }}>{studySessions.length}</div>
            <div style={{ color: 'var(--ink-muted)' }}>Study Sessions</div>
          </div>
          <div>
            <div className="text-3xl font-bold" style={{ color: 'var(--ink-text)' }}>{sleepSessions.length}</div>
            <div style={{ color: 'var(--ink-muted)' }}>Sleep Sessions</div>
          </div>
        </div>
      </div>
    </div>
  )
}

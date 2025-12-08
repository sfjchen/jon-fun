'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  GAME24_MAX_PLAYERS,
  GAME24_MAX_ROUNDS,
  GAME24_ROUND_DURATION_MS,
  validateRoomPin,
} from '@/lib/game24'
import { Solver24 } from '@/lib/solver24'

interface Card {
  value: number
  expression: string
  isResult: boolean
  position: number
}

interface GameState {
  numbers: number[]
  cards: Card[]
  selectedCard: number | null
  pendingOperation: string | null
}

interface Room {
  pin: string
  host_id: string | null
  status: 'waiting' | 'active' | 'intermission' | 'finished'
  round_number: number
  current_round_started_at: string | null
  intermission_until: string | null
  max_players: number
}

interface RoundData {
  round_number: number
  numbers: number[]
  started_at: string
}

interface Player {
  player_id: string
  name: string
  score: number
}

const OPERATORS = [
  { op: '+', class: 'plus', symbol: '+' },
  { op: '-', class: 'minus', symbol: '−' },
  { op: '*', class: 'multiply', symbol: '×' },
  { op: '/', class: 'divide', symbol: '÷' },
] as const

const buildCards = (numbers: number[]): Card[] =>
  numbers.map((num, index) => ({
    value: num,
    expression: num.toString(),
    isResult: false,
    position: index,
  }))

const formatSeconds = (seconds: number) => {
  const clamped = Math.max(0, seconds)
  return clamped.toFixed(1).replace(/\.0$/, '')
}

export default function Game24() {
  const solver = useMemo(() => new Solver24(), [])
  const [gameState, setGameState] = useState<GameState>({
    numbers: [],
    cards: [],
    selectedCard: null,
    pendingOperation: null,
  })
  const [message, setMessage] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [round, setRound] = useState<RoundData | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [hostId, setHostId] = useState<string | null>(null)
  const [offlineScore, setOfflineScore] = useState(0)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'active' | 'intermission' | 'finished'>('idle')
  const [loadingRoom, setLoadingRoom] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roundRemainingMs, setRoundRemainingMs] = useState(0)
  const [intermissionRemainingMs, setIntermissionRemainingMs] = useState(0)
  const [practiceCards, setPracticeCards] = useState<Card[]>(buildCards([4, 6, 8, 1]))
  const [practiceSelected, setPracticeSelected] = useState<number | null>(null)
  const [practicePendingOp, setPracticePendingOp] = useState<string | null>(null)
  const [practiceNumbers, setPracticeNumbers] = useState<number[]>([4, 6, 8, 1])
  const practiceMessageRef = useRef<NodeJS.Timeout | null>(null)

  const pendingAdvanceRef = useRef(false)
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isHost = hostId && room?.host_id === hostId

  const showTemporaryMessage = useCallback((msg: string, durationMs = 2500) => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current)
    }
    setMessage(msg)
    messageTimeoutRef.current = setTimeout(() => {
      setMessage(null)
      messageTimeoutRef.current = null
    }, durationMs)
  }, [])

  const saveSession = useCallback(
    (data: { pin?: string; playerId?: string; hostId?: string; playerName?: string }) => {
      if (typeof window === 'undefined') return
      if (data.pin) sessionStorage.setItem('game24_pin', data.pin)
      if (data.playerId) sessionStorage.setItem('game24_playerId', data.playerId)
      if (data.hostId !== undefined) sessionStorage.setItem('game24_hostId', data.hostId ?? '')
      if (data.playerName) sessionStorage.setItem('game24_playerName', data.playerName)
    },
    []
  )

  const loadRoomData = useCallback(async (pin: string) => {
    setLoadingRoom(true)
    setError(null)
    try {
      const response = await fetch(`/api/game24/rooms/${pin}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load room')
      }

      setRoom(data.room)
      setPlayers(data.players || [])
      setRound(data.round || null)
      setHostId(data.room.host_id ?? null)
      setPhase(data.room.status ?? 'waiting')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room')
    } finally {
      setLoadingRoom(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedPin = sessionStorage.getItem('game24_pin') || ''
    const savedPlayerId = sessionStorage.getItem('game24_playerId') || ''
    const savedHostId = sessionStorage.getItem('game24_hostId') || ''
    const savedName = sessionStorage.getItem('game24_playerName') || ''

    // Prefill but do NOT auto-rejoin; require explicit join/resume.
    if (savedPin && savedPlayerId) {
      setPinInput(savedPin)
      setPlayerId(savedPlayerId)
      setHostId(savedHostId || null)
      setNameInput(savedName)
    } else {
      setNameInput(savedName || '')
    }
  }, [])

  useEffect(() => {
    if (!room) {
      setPhase('idle')
      return
    }
    setPhase(room.status)
  }, [room])

  useEffect(() => {
    if (!round || !round.numbers) return
    setGameState({
      numbers: round.numbers,
      cards: buildCards(round.numbers),
      selectedCard: null,
      pendingOperation: null,
    })
    setHasSubmitted(false)
  }, [round])

  useEffect(() => {
    if (!pinInput) return

    const roomChannel = supabase
      .channel(`game24:room:${pinInput}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game24_rooms', filter: `pin=eq.${pinInput}` },
        () => loadRoomData(pinInput)
      )
      .subscribe()

    const playersChannel = supabase
      .channel(`game24:players:${pinInput}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game24_players', filter: `room_pin=eq.${pinInput}` },
        () => loadRoomData(pinInput)
      )
      .subscribe()

    const roundsChannel = supabase
      .channel(`game24:rounds:${pinInput}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game24_rounds', filter: `room_pin=eq.${pinInput}` },
        () => loadRoomData(pinInput)
      )
      .subscribe()

    return () => {
      roomChannel.unsubscribe()
      playersChannel.unsubscribe()
      roundsChannel.unsubscribe()
    }
  }, [pinInput, loadRoomData])

  const advanceRound = useCallback(async () => {
    if (!pinInput) return
    try {
      const response = await fetch('/api/game24/next-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to advance round')
      }
      pendingAdvanceRef.current = false
      await loadRoomData(pinInput)
    } catch (err) {
      pendingAdvanceRef.current = false
      showTemporaryMessage(err instanceof Error ? err.message : 'Failed to advance round')
    }
  }, [pinInput, loadRoomData, showTemporaryMessage])

  useEffect(() => {
    const interval = setInterval(() => {
      const startTime = room?.current_round_started_at ?? round?.started_at ?? null

      if (room?.status === 'active' && startTime) {
        const startTs = new Date(startTime).getTime()
        if (!Number.isFinite(startTs)) {
          setRoundRemainingMs(0)
        } else {
          const elapsed = Math.max(0, Date.now() - startTs)
          const remaining = Math.max(0, GAME24_ROUND_DURATION_MS - elapsed)
        setRoundRemainingMs(remaining)
          if (remaining <= 0 && !pendingAdvanceRef.current && elapsed >= GAME24_ROUND_DURATION_MS) {
            pendingAdvanceRef.current = true
            advanceRound()
          }
        }
      } else {
        setRoundRemainingMs(0)
      }

      if (room?.status === 'intermission' && room.intermission_until) {
        const remaining = new Date(room.intermission_until).getTime() - Date.now()
        setIntermissionRemainingMs(Math.max(0, remaining))
        if (remaining <= 0 && !pendingAdvanceRef.current) {
          pendingAdvanceRef.current = true
          advanceRound()
        }
      } else {
        setIntermissionRemainingMs(0)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [room, round, advanceRound])

  useEffect(() => {
    if (room?.status) {
      pendingAdvanceRef.current = false
    }
  }, [room?.status, room?.round_number, room?.current_round_started_at])

  const resetSelections = useCallback(() => {
    if (phase === 'active' && (round?.numbers?.length ?? 0) > 0) {
      setGameState({
        numbers: round!.numbers,
        cards: buildCards(round!.numbers),
        selectedCard: null,
        pendingOperation: null,
      })
    } else {
      setPracticeCards(buildCards(practiceNumbers))
      setPracticeSelected(null)
      setPracticePendingOp(null)
    }
  }, [phase, practiceNumbers, round])

  const selectCard = useCallback((index: number) => {
    setGameState((prev) => {
      if (prev.selectedCard === index && prev.pendingOperation === null) {
        return { ...prev, selectedCard: null }
      }
      if (prev.pendingOperation !== null) {
        return prev
      }
      return { ...prev, selectedCard: index }
    })
  }, [])

  const addOperator = useCallback((op: string) => {
    setGameState((prev) => {
      if (phase !== 'active' || prev.selectedCard === null) return prev
      return { ...prev, pendingOperation: op }
    })
  }, [phase])

  const submitSolution = useCallback(
    async (expression: string) => {
      if (!room || !playerId || !pinInput || hasSubmitted || phase !== 'active') return
      setHasSubmitted(true)
      const normalizedExpression = expression.replace(/×/g, '*').replace(/÷/g, '/')
      const response = await fetch('/api/game24/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput, playerId, expression: normalizedExpression }),
      })
      const data = await response.json()
      if (!response.ok) {
        setHasSubmitted(false)
        showTemporaryMessage(data.error || 'Failed to submit')
        return
      }
      showTemporaryMessage(`Submitted! +${data.scoreAwarded ?? 0} pts`, 1500)
      if (data.roundFinished) {
        await loadRoomData(pinInput)
      }
    },
    [room, playerId, pinInput, hasSubmitted, phase, showTemporaryMessage, loadRoomData]
  )

  const performOperation = useCallback(
    (secondCardIndex: number) => {
      if (phase !== 'active') return
      setGameState((prev) => {
        if (prev.selectedCard === null || prev.pendingOperation === null) return prev

        const firstCard = prev.cards[prev.selectedCard]
        const secondCard = prev.cards[secondCardIndex]

        if (!firstCard || !secondCard) return prev

        try {
          let result: number
          let expression: string

          switch (prev.pendingOperation) {
            case '+':
              result = firstCard.value + secondCard.value
              expression = `(${firstCard.expression} + ${secondCard.expression})`
              break
            case '-':
              result = firstCard.value - secondCard.value
              expression = `(${firstCard.expression} - ${secondCard.expression})`
              break
            case '*':
              result = firstCard.value * secondCard.value
              expression = `(${firstCard.expression} × ${secondCard.expression})`
              break
            case '/':
              if (secondCard.value === 0) {
                showTemporaryMessage('❌ Cannot divide by zero!')
                return { ...prev, selectedCard: null, pendingOperation: null }
              }
              result = firstCard.value / secondCard.value
              expression = `(${firstCard.expression} ÷ ${secondCard.expression})`
              break
            default:
              return prev
          }

          const newCards = prev.cards
            .map((card, i) => {
              if (i === prev.selectedCard) return null
              if (i === secondCardIndex) {
                return {
                  value: result,
                  expression,
                  isResult: true,
                  position: card.position,
                }
              }
              return card
            })
            .filter((card): card is Card => card !== null)

          const resultCardIndex = newCards.findIndex((card) => card.position === secondCard.position)

          if (newCards.length === 1 && Math.abs(newCards[0]!.value - 24) < 0.001) {
            submitSolution(newCards[0]!.expression)
          }

          return {
            ...prev,
            cards: newCards,
            selectedCard: resultCardIndex,
            pendingOperation: null,
          }
        } catch {
          showTemporaryMessage('❌ Invalid operation')
          return { ...prev, selectedCard: null, pendingOperation: null }
        }
      })
    },
    [phase, submitSolution, showTemporaryMessage]
  )

  useEffect(() => {
    if (gameState.pendingOperation !== null && gameState.selectedCard !== null) {
      const handleClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement
        if (target.closest('.game-card') && !target.closest('.game-card.selected')) {
          const cardIndex = gameState.cards.findIndex((_, index) => target.closest(`[data-card-index="${index}"]`))
          if (cardIndex !== -1 && cardIndex !== gameState.selectedCard) {
            performOperation(cardIndex)
          }
        }
      }

      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [gameState.pendingOperation, gameState.selectedCard, gameState.cards, performOperation])

  const createRoom = async () => {
    if (!nameInput.trim()) {
      setError('Name is required')
      return
    }
    setError(null)
    setLoadingRoom(true)
    try {
      const response = await fetch('/api/game24/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: nameInput.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create room')
      }
      setPinInput(data.pin)
      setPlayerId(data.playerId)
      setHostId(data.hostId)
      saveSession({ pin: data.pin, playerId: data.playerId, hostId: data.hostId, playerName: nameInput.trim() })
      await loadRoomData(data.pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setLoadingRoom(false)
    }
  }

  const joinRoom = async () => {
    if (!nameInput.trim() || !validateRoomPin(pinInput)) {
      setError('Valid name and 4-digit PIN required')
      return
    }
    setError(null)
    setLoadingRoom(true)
    try {
      const response = await fetch(`/api/game24/rooms/${pinInput}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', playerName: nameInput.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join room')
      }
      setPlayerId(data.playerId)
      saveSession({ pin: pinInput, playerId: data.playerId, playerName: nameInput.trim() })
      await loadRoomData(pinInput)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setLoadingRoom(false)
    }
  }

  const startGame = async () => {
    if (!isHost || !pinInput) return
    const response = await fetch(`/api/game24/rooms/${pinInput}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', hostId }),
    })
    const data = await response.json()
    if (!response.ok) {
      showTemporaryMessage(data.error || 'Failed to start')
      return
    }
    await loadRoomData(pinInput)
  }

  const playAgain = async () => {
    if (!pinInput || !playerId) return
    const response = await fetch(`/api/game24/rooms/${pinInput}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'play-again', playerId }),
    })
    const data = await response.json()
    if (!response.ok) {
      showTemporaryMessage(data.error || 'Failed to reset')
      return
    }
    setHostId(data.hostId ?? null)
    setPlayerId(data.playerId ?? playerId)
    saveSession({ hostId: data.hostId ?? null, playerId: data.playerId ?? playerId })
    await loadRoomData(pinInput)
  }

  const leaveRoom = useCallback(async () => {
    if (!pinInput || !playerId) return
    await fetch(`/api/game24/rooms/${pinInput}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave', playerId }),
    })
    setRoom(null)
    setPlayers([])
    setRound(null)
    setPhase('idle')
    setPinInput('')
    setPlayerId(null)
    setHostId(null)
    saveSession({ pin: '', playerId: '', hostId: '' })
  }, [pinInput, playerId, saveSession, loadRoomData])

  const sortedPlayers = useMemo(() => {
    const list = [...players]
    list.sort((a, b) => {
      if (b.score === a.score) return a.name.localeCompare(b.name)
      return (b.score ?? 0) - (a.score ?? 0)
    })
    return list
  }, [players])

  const renderCardAtPosition = useCallback(
    (position: number) => {
      const cardIndex = gameState.cards.findIndex((card) => card.position === position)
    
    if (cardIndex === -1) {
      return <div key={position} className="game-card empty" style={{ opacity: 0, pointerEvents: 'none' }} />
    }
    
    const card = gameState.cards[cardIndex]
    if (!card) {
      return <div key={position} className="game-card empty" style={{ opacity: 0, pointerEvents: 'none' }} />
    }
    
    const isSelected = gameState.selectedCard === cardIndex
    const isResult = card.isResult
    const isPending = gameState.pendingOperation !== null && gameState.selectedCard === cardIndex
    
    let cardClass = 'game-card'
    if (isSelected) cardClass += ' selected'
    if (isResult) cardClass += ' result'
    if (isPending) cardClass += ' pending'
    
    return (
      <button 
        key={position}
        className={cardClass}
          onClick={() => selectCard(cardIndex)}
          data-card-index={cardIndex}
          disabled={phase !== 'active'}
        >
          <div className="card-content">
            <span className="card-number">{card.value}</span>
            {isResult && <div className="card-expression">{card.expression}</div>}
          </div>
        </button>
      )
    },
    [gameState.cards, gameState.selectedCard, gameState.pendingOperation, selectCard, phase]
  )

  // Practice mode helpers (offline, no timer, hint enabled)
  const generatePractice = useCallback(() => {
    let numbers = [4, 6, 8, 1]
    const maxAttempts = 80
    for (let i = 0; i < maxAttempts; i++) {
      const candidate = Array.from({ length: 4 }, () => Math.floor(Math.random() * 9) + 1)
      if (solver.hasSolution(candidate)) {
        numbers = candidate
        break
      }
    }
    setPracticeNumbers(numbers)
    setPracticeCards(buildCards(numbers))
    setPracticeSelected(null)
    setPracticePendingOp(null)
  }, [solver])

  useEffect(() => {
    generatePractice()
    return () => {
      if (practiceMessageRef.current) clearTimeout(practiceMessageRef.current)
    }
  }, [generatePractice])

  const performPractice = useCallback(
    (secondIndex: number) => {
      if (practiceSelected === null || practicePendingOp === null) return
      setPracticeCards((prev) => {
        const firstCard = prev[practiceSelected]
        const secondCard = prev[secondIndex]
        if (!firstCard || !secondCard) return prev

        let result: number
        let expression: string

        switch (practicePendingOp) {
          case '+':
            result = firstCard.value + secondCard.value
            expression = `(${firstCard.expression} + ${secondCard.expression})`
            break
          case '-':
            result = firstCard.value - secondCard.value
            expression = `(${firstCard.expression} - ${secondCard.expression})`
            break
          case '*':
            result = firstCard.value * secondCard.value
            expression = `(${firstCard.expression} × ${secondCard.expression})`
            break
          case '/':
            if (secondCard.value === 0) {
              showTemporaryMessage('❌ Cannot divide by zero!')
              setPracticeSelected(null)
              setPracticePendingOp(null)
              return prev
            }
            result = firstCard.value / secondCard.value
            expression = `(${firstCard.expression} ÷ ${secondCard.expression})`
            break
          default:
            return prev
        }

        const updated = prev
          .map((card, i) => {
            if (i === practiceSelected) return null
            if (i === secondIndex) {
              return { value: result, expression, isResult: true, position: card.position }
            }
            return card
          })
          .filter((card): card is Card => card !== null)

        const solved = updated.length === 1 && Math.abs(updated[0]!.value - 24) < 0.001
        if (solved) {
          setOfflineScore((prev) => prev + 1000)
          practiceMessageRef.current = setTimeout(() => {
            showTemporaryMessage('Solved! New puzzle coming up.', 1800)
            generatePractice()
          }, 100)
        }

        setPracticeSelected(updated.findIndex((c) => c.position === secondCard.position))
        setPracticePendingOp(null)
        return updated
      })
    },
    [practicePendingOp, practiceSelected, generatePractice, showTemporaryMessage]
  )

  const selectPracticeCard = useCallback(
    (index: number) => {
      if (practicePendingOp !== null && practiceSelected !== null && index !== practiceSelected) {
        performPractice(index)
        return
      }
      setPracticeSelected((prev) => (prev === index && practicePendingOp === null ? null : index))
    },
    [practicePendingOp, practiceSelected, performPractice]
  )

  const addPracticeOp = useCallback((op: string) => {
    if (practiceSelected === null) return
    setPracticePendingOp(op)
  }, [practiceSelected])

  useEffect(() => {
    return () => {
      if (practiceMessageRef.current) clearTimeout(practiceMessageRef.current)
    }
  }, [])

  const renderPracticeCard = useCallback(
    (position: number) => {
      const cardIndex = practiceCards.findIndex((card) => card.position === position)
      if (cardIndex === -1) {
        return <div key={position} className="game-card empty" style={{ opacity: 0, pointerEvents: 'none' }} />
      }
      const card = practiceCards[cardIndex]
      if (!card) {
        return <div key={position} className="game-card empty" style={{ opacity: 0, pointerEvents: 'none' }} />
      }
      const isSelected = practiceSelected === cardIndex
      const isResult = card.isResult
      const isPending = practicePendingOp !== null && practiceSelected === cardIndex
      let cardClass = 'game-card practice-card'
      if (isSelected) cardClass += ' selected'
      if (isResult) cardClass += ' result'
      if (isPending) cardClass += ' pending'
      return (
        <button
          key={position}
          className={cardClass}
          onClick={() => selectPracticeCard(cardIndex)}
          data-practice-index={cardIndex}
      >
        <div className="card-content">
          <span className="card-number">{card.value}</span>
          {isResult && <div className="card-expression">{card.expression}</div>}
        </div>
      </button>
    )
    },
    [practiceCards, practicePendingOp, practiceSelected, selectPracticeCard]
  )

  const showPracticeSolution = useCallback(() => {
    const solution = solver.getSolution(practiceNumbers)
    if (solution) {
      showTemporaryMessage(`💡 Solution: ${solution}`)
    } else {
      showTemporaryMessage('No solution found')
    }
  }, [practiceNumbers, solver, showTemporaryMessage])

  const roundProgressRatio =
    room?.status === 'active' && GAME24_ROUND_DURATION_MS > 0
      ? Math.max(0, Math.min(1, roundRemainingMs / GAME24_ROUND_DURATION_MS))
      : 0

  const displayedScore =
    room && room.status !== 'waiting'
      ? players.find((p) => p.player_id === playerId)?.score ?? 0
      : offlineScore

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-start lg:items-center">
      <div className="max-w-6xl mx-auto px-4 py-10 lg:py-14 flex flex-col gap-6 w-full">
        <div className="grid lg:grid-cols-[320px_1fr] gap-6 order-1">
          <aside className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-white">
            {!room && (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-200 mb-1">Name</div>
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <div className="text-sm text-gray-200 mb-1">Room PIN</div>
                    <input
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      maxLength={4}
                      className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                      placeholder="1234"
                    />
                  </div>
        <button 
                    onClick={joinRoom}
                    disabled={loadingRoom}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-2 rounded"
        >
                    Join
        </button>
                </div>
                <button
                  onClick={createRoom}
                  disabled={loadingRoom}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-3 py-2 rounded"
                >
                  Create Room
                </button>
                {error && <div className="text-red-300 text-sm">{error}</div>}
              </div>
            )}

            {room && (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-300">Room PIN</div>
                  <div className="text-3xl font-bold tracking-widest">{room.pin}</div>
                  <div className="text-xs text-gray-300 mt-1">Share the PIN to let others join</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-300">Status</div>
                  <div className="text-sm font-semibold">
                    {room.status === 'waiting' && 'Waiting'}
                    {room.status === 'active' && `Round ${room.round_number}/${GAME24_MAX_ROUNDS}`}
                    {room.status === 'intermission' && 'Intermission'}
                    {room.status === 'finished' && 'Finished'}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-lg font-semibold">Players ({players.length}/{room.max_players ?? GAME24_MAX_PLAYERS})</div>
                    {isHost && <span className="text-xs bg-green-600 px-2 py-1 rounded">Host</span>}
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {sortedPlayers.map((p) => (
                      <div
                        key={p.player_id}
                        className={`bg-white/5 border rounded-lg px-3 py-2 flex items-center justify-between ${
                          p.player_id === room.host_id ? 'border-green-400/60' : 'border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-white font-semibold truncate">{p.name}</div>
                          {p.player_id === room.host_id && <span className="text-xs bg-green-600 px-2 py-0.5 rounded">Host</span>}
                        </div>
                        <div className="text-sm text-gray-200 font-mono">{p.score ?? 0}</div>
                      </div>
                    ))}
                    {players.length === 0 && <div className="text-gray-300 text-sm">No players yet</div>}
                  </div>
                </div>

                {room.status === 'waiting' && isHost && (
                  <button
                    onClick={startGame}
                    disabled={players.length < 1 || loadingRoom}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 rounded font-semibold"
                  >
                    {players.length < 1 ? 'Need at least 1 player' : 'Start Game'}
                  </button>
                )}

                {room.status === 'finished' && (
                  <button
                    onClick={playAgain}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold"
                  >
                    Play Again
                  </button>
                )}

                {room && (
                  <button
                    onClick={() => leaveRoom()}
                    className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded font-semibold border border-white/20"
                  >
                    Leave Room
                  </button>
                )}

                {error && <div className="text-red-300 text-sm">{error}</div>}
              </div>
            )}
          </aside>

          <main className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-white relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 text-white">
              <Link href="/" className="header-icon" aria-label="Go home">
                🏠
              </Link>
              <div className="text-center">
                <div className="text-lg font-semibold">Your Score</div>
                <div className="bg-white/10 rounded-lg px-4 py-2 mt-1 text-2xl font-bold">
                  {displayedScore}
                </div>
              </div>
              <button onClick={resetSelections} className="header-icon text-2xl" aria-label="Reset selection">
                ↻
              </button>
            </div>

            {(room?.status === 'active' || room?.status === 'intermission') && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-lg font-semibold">
                    {room?.status === 'active' ? `Round ${room.round_number}/${GAME24_MAX_ROUNDS}` : 'Intermission'}
                  </div>
                  <div className="text-sm text-gray-200">
                    {room?.status === 'intermission'
                      ? `Next round in ${formatSeconds(intermissionRemainingMs / 1000)}s`
                      : ''}
                  </div>
                </div>

                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-green-400 transition-all"
                    style={{ width: `${roundProgressRatio * 100}%`, transition: 'width 0.18s linear' }}
                  />
                </div>
              </>
            )}

                {room?.status === 'intermission' && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
                <div className="text-2xl font-bold">Scores</div>
                <div className="w-full max-w-md space-y-2">
                  {sortedPlayers.map((p, idx) => (
                    <div
                      key={p.player_id}
                      className="flex items-center justify-between bg-white/10 px-3 py-2 rounded border border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-300 w-6 text-right">{idx + 1}.</span>
                        <span className="font-semibold">{p.name}</span>
                      </div>
                      <span className="font-mono text-sm">{p.score ?? 0}</span>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-gray-200">Next round auto-starts</div>
              </div>
            )}

            {room?.status === 'finished' && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20">
                <div className="text-3xl font-bold">Final Rankings</div>
                <div className="w-full max-w-md space-y-2">
                  {sortedPlayers.map((p, idx) => (
                    <div
                      key={p.player_id}
                      className="flex items-center justify-between bg-white/10 px-3 py-2 rounded border border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-300 w-6 text-right">{idx + 1}.</span>
                        <span className="font-semibold">{p.name}</span>
                      </div>
                      <span className="font-mono text-sm">{p.score ?? 0}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={playAgain}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-semibold"
                >
                  Play Again
                </button>
              </div>
            )}

            <div className="max-w-xl mx-auto p-4 space-y-8">
              <div>
                {phase === 'active' ? (
                  <>
                    <div className="game-board mb-4">
                      {[0, 1, 2, 3].map((position) => renderCardAtPosition(position))}
                    </div>
                    <div className="flex justify-center gap-4 mb-4">
                      {OPERATORS.map(({ op, class: className, symbol }) => (
                        <button
                          key={op}
                          className={`operator-btn ${className} ${gameState.pendingOperation === op ? 'selected' : ''}`}
                          onClick={() => addOperator(op)}
                          aria-label={`${op} operator`}
                          disabled={phase !== 'active'}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                    <div className="text-center text-gray-200 text-sm">
                      {hasSubmitted ? 'You submitted this round.' : 'Solve to score up to 2000 points (20s round).'}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="game-board mb-4">
                      {[0, 1, 2, 3].map((position) => renderPracticeCard(position))}
                    </div>
                    <div className="flex justify-center gap-4 mb-4">
                      {OPERATORS.map(({ op, class: className, symbol }) => (
                        <button
                          key={op}
                          className={`operator-btn ${className} ${practicePendingOp === op ? 'selected' : ''}`}
                          onClick={() => addPracticeOp(op)}
                          aria-label={`${op} operator`}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-center gap-3 mb-2">
                      <button
                        onClick={generatePractice}
                        className="action-btn danger"
                      >
                        🔄 New Puzzle
                      </button>
                      <button
                        onClick={showPracticeSolution}
                        className="action-btn primary"
                      >
                        💡 Solution
                      </button>
                    </div>
                    <div className="text-center text-gray-200 text-sm">
                      Free play while waiting/not in a room. Timer/solution disable only when a round is active.
                    </div>
                  </>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {message && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg z-50 border border-white/20">
          {message}
        </div>
      )}
    </div>
  )
}

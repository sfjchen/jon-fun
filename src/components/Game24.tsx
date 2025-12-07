'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Solver24 } from '@/lib/solver24'
import Link from 'next/link'

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
  score: number
  level: number
  totalTimeElapsed: number
  roundTimeElapsed: number
  gameStartTime: number
  roundStartTime: number
  isGameActive: boolean
}

const OPERATORS = [
  { op: '+', class: 'plus', symbol: '+' },
  { op: '-', class: 'minus', symbol: '−' },
  { op: '*', class: 'multiply', symbol: '×' },
  { op: '/', class: 'divide', symbol: '÷' },
] as const

export default function Game24() {
  const [gameState, setGameState] = useState<GameState>({
    numbers: [],
    cards: [],
    selectedCard: null,
    pendingOperation: null,
    score: 0,
    level: 1,
    totalTimeElapsed: 0,
    roundTimeElapsed: 0,
    gameStartTime: 0,
    roundStartTime: 0,
    isGameActive: false,
  })
  const [message, setMessage] = useState<string | null>(null)

  const solver = useMemo(() => new Solver24(), [])

  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showTemporaryMessage = useCallback((msg: string) => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current)
    }
    setMessage(msg)
    messageTimeoutRef.current = setTimeout(() => {
      setMessage(null)
      messageTimeoutRef.current = null
    }, 3000)
  }, [])

  const generateNumbers = useCallback(() => {
    let newNumbers: number[] = [4, 6, 8, 1]
    const maxAttempts = 50
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = Array.from({ length: 4 }, () => Math.floor(Math.random() * 9) + 1)
      if (solver.hasSolution(candidate)) {
        newNumbers = candidate
        break
      }
    }

    const newCards = newNumbers.map((num, index) => ({
      value: num,
      expression: num.toString(),
      isResult: false,
      position: index
    }))

    setGameState(prev => ({
      ...prev,
      numbers: newNumbers,
      cards: newCards,
    }))
  }, [solver])

  const initializeGame = useCallback(() => {
    const now = Date.now()
    const defaultNumbers = [4, 6, 8, 1]
    const defaultCards = defaultNumbers.map((num, index) => ({
      value: num,
      expression: num.toString(),
      isResult: false,
      position: index
    }))

    setGameState(prev => ({
      ...prev,
      numbers: defaultNumbers,
      cards: defaultCards,
      gameStartTime: now,
      roundStartTime: now,
      isGameActive: true,
    }))

    // Generate new numbers after initialization
    setTimeout(generateNumbers, 100)
  }, [generateNumbers])

  const newGame = useCallback(() => {
    const now = Date.now()
    setGameState(prev => ({
      ...prev,
      selectedCard: null,
      pendingOperation: null,
      score: 0,
      level: 0,
      gameStartTime: now,
      roundStartTime: now,
      isGameActive: true,
    }))
    generateNumbers()
  }, [generateNumbers])

  const resetRound = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      cards: prev.numbers.map((num, index) => ({
        value: num,
        expression: num.toString(),
        isResult: false,
        position: index
      })),
      selectedCard: null,
      pendingOperation: null,
    }))
  }, [])

  const startNewRound = useCallback(() => {
    const now = Date.now()
    setGameState(prev => ({
      ...prev,
      roundStartTime: now,
      selectedCard: null,
      pendingOperation: null,
    }))
    generateNumbers()
  }, [generateNumbers])

  const selectCard = useCallback((index: number) => {
    setGameState(prev => {
      if (prev.selectedCard === index && prev.pendingOperation === null) {
        return { ...prev, selectedCard: null }
      }
      
      if (prev.pendingOperation !== null) {
        return prev // Will be handled by performOperation
      }
      
      return { ...prev, selectedCard: index }
    })
  }, [])

  const addOperator = useCallback((op: string) => {
    setGameState(prev => {
      if (prev.selectedCard === null) return prev
      return { ...prev, pendingOperation: op }
    })
  }, [])

  const performOperation = useCallback((secondCardIndex: number) => {
    setGameState(prev => {
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
        
        const newCards = prev.cards.map((card, i) => {
          if (i === prev.selectedCard) {
            return null
          } else if (i === secondCardIndex) {
            return {
              value: result,
              expression: expression,
              isResult: true,
              position: card.position
            }
          } else {
            return card
          }
        }).filter((card): card is Card => card !== null)
        
        const resultCardIndex = newCards.findIndex(card => card.position === secondCard.position)
        
        if (newCards.length === 1 && newCards[0] && Math.abs(newCards[0].value - 24) < 0.001) {
          setTimeout(() => {
            setGameState(current => ({
              ...current,
              score: current.score + 1,
              level: current.level + 1,
            }))
            setTimeout(startNewRound, 1000)
          }, 100)
        } else if (newCards.length === 1 && newCards[0] && Math.abs(newCards[0].value - 24) >= 0.001) {
          setTimeout(() => {
            setGameState(current => ({
              ...current,
              score: 0,
              level: 0,
            }))
            setTimeout(startNewRound, 1000)
          }, 100)
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
  }, [startNewRound, showTemporaryMessage])

  const showHint = useCallback(() => {
    const solution = solver.getSolution(gameState.numbers)
    if (solution) {
      showTemporaryMessage(`💡 Solution: ${solution}`)
    } else {
      showTemporaryMessage('💡 No hint available')
    }
  }, [solver, gameState.numbers, showTemporaryMessage])

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Initialize game on mount
  useEffect(() => {
    initializeGame()
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current)
      }
    }
  }, [initializeGame])

  // Timer effect
  useEffect(() => {
    if (!gameState.isGameActive) return

    const interval = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        totalTimeElapsed: Math.floor((Date.now() - prev.gameStartTime) / 1000),
        roundTimeElapsed: Math.floor((Date.now() - prev.roundStartTime) / 1000),
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [gameState.isGameActive])

  // Handle operation when pending
  useEffect(() => {
    if (gameState.pendingOperation !== null && gameState.selectedCard !== null) {
      const handleClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement
        if (target.closest('.game-card') && !target.closest('.game-card.selected')) {
          const cardIndex = gameState.cards.findIndex((_, index) => 
            target.closest(`[data-card-index="${index}"]`)
          )
          if (cardIndex !== -1 && cardIndex !== gameState.selectedCard) {
            performOperation(cardIndex)
          }
        }
      }

      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [gameState.pendingOperation, gameState.selectedCard, gameState.cards, performOperation])

  const renderCardAtPosition = useCallback((position: number) => {
    const cardIndex = gameState.cards.findIndex(card => card.position === position)
    
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
      >
        <div className="card-content">
          <span className="card-number">{card.value}</span>
          {isResult && <div className="card-expression">{card.expression}</div>}
        </div>
      </button>
    )
  }, [gameState.cards, gameState.selectedCard, gameState.pendingOperation, selectCard])

  return (
    <div>
      {/* Header Section */}
      <div className="header-section bg-transparent">
        <Link href="/" className="header-icon" aria-label="Go home">
          🏠
        </Link>
        
        <div className="text-center">
          <div className="text-white text-lg font-semibold">Streak</div>
          <div className="bg-blue-800 rounded-lg px-4 py-2 mt-1">
            <div className="text-white text-2xl font-bold">{gameState.score}</div>
          </div>
        </div>
        
        <button 
          onClick={resetRound}
          className="header-icon text-2xl"
          aria-label="Reset round"
        >
          ↻
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto p-4">
        {/* Game Board Section */}
        <div className="game-board mb-6">
          {[0, 1, 2, 3].map(position => renderCardAtPosition(position))}
        </div>

        {/* Operator Section */}
        <div className="flex justify-center gap-4 mb-6">
          {OPERATORS.map(({ op, class: className, symbol }) => (
            <button
              key={op}
              className={`operator-btn ${className} ${gameState.pendingOperation === op ? 'selected' : ''}`}
              onClick={() => addOperator(op)}
              aria-label={`${op} operator`}
            >
              {symbol}
            </button>
          ))}
        </div>

        {/* Timer Section */}
        <div className="flex justify-between items-center mb-6 text-gray-300">
          <div className="text-center">
            <div className="text-sm opacity-80">Total Time</div>
            <div className="text-lg font-bold">{formatTime(gameState.totalTimeElapsed)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm opacity-80">Round Time</div>
            <div className="text-lg font-bold">{formatTime(gameState.roundTimeElapsed)}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button 
            onClick={newGame}
            className="action-btn danger"
          >
            <span>🔄 New Game</span>
          </button>
          <button 
            onClick={showHint}
            className="action-btn primary"
          >
            <span>💡 Solution</span>
          </button>
        </div>
      </div>

      {/* Message overlay */}
      {message && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg z-50 border border-white/20">
          {message}
        </div>
      )}
    </div>
  )
}

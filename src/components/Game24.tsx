'use client'

import { useState, useEffect } from 'react'
import { Solver24 } from '@/lib/solver24'
import Link from 'next/link'

interface Card {
  value: number
  expression: string
  isResult: boolean
  position: number
}

export default function Game24() {
  const [numbers, setNumbers] = useState<number[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [pendingOperation, setPendingOperation] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0)
  const [roundTimeElapsed, setRoundTimeElapsed] = useState(0)
  const [gameStartTime, setGameStartTime] = useState(0)
  const [roundStartTime, setRoundStartTime] = useState(0)
  const [isGameActive, setIsGameActive] = useState(false)
  const [solver] = useState(() => new Solver24())

  useEffect(() => {
    setGameStartTime(Date.now())
    // Ensure game starts with default numbers if generateNumbers fails
    const defaultNumbers = [4, 6, 8, 1]
    setNumbers(defaultNumbers)
    setCards(defaultNumbers.map((num, index) => ({
      value: num,
      expression: num.toString(),
      isResult: false,
      position: index
    })))
    setIsGameActive(true)
    setRoundStartTime(Date.now())
    
    // Try to generate new numbers
    setTimeout(() => {
      generateNumbers()
    }, 100)
  }, [])

  useEffect(() => {
    if (!isGameActive) return

    const interval = setInterval(() => {
      setTotalTimeElapsed(Math.floor((Date.now() - gameStartTime) / 1000))
      setRoundTimeElapsed(Math.floor((Date.now() - roundStartTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isGameActive, gameStartTime, roundStartTime])

  const generateNumbers = () => {
    let attempts = 0
    let newNumbers: number[]
    
    do {
      newNumbers = Array.from({ length: 4 }, () => Math.floor(Math.random() * 9) + 1)
      attempts++
    } while (!solver.hasSolution(newNumbers) && attempts < 100)

    if (!solver.hasSolution(newNumbers)) {
      newNumbers = [4, 6, 8, 1] // Known solvable
    }

    setNumbers(newNumbers)
    const newCards = newNumbers.map((num, index) => ({
      value: num,
      expression: num.toString(),
      isResult: false,
      position: index
    }))
    setCards(newCards)
  }

  const newGame = () => {
    generateNumbers()
    setIsGameActive(true)
    setGameStartTime(Date.now()) // Reset total timer
    setRoundStartTime(Date.now())
    setSelectedCard(null)
    setPendingOperation(null)
    setScore(0)
    setLevel(0)
  }

  const resetRound = () => {
    setCards(numbers.map((num, index) => ({
      value: num,
      expression: num.toString(),
      isResult: false,
      position: index
    })))
    setSelectedCard(null)
    setPendingOperation(null)
  }

  const startNewRound = () => {
    generateNumbers()
    setRoundStartTime(Date.now())
    setSelectedCard(null)
    setPendingOperation(null)
  }

  const selectCard = (index: number) => {
    if (selectedCard === index && pendingOperation === null) {
      setSelectedCard(null)
      return
    }
    
    if (pendingOperation !== null) {
      performOperation(index)
      return
    }
    
    setSelectedCard(index)
  }

  const addOperator = (op: string) => {
    if (selectedCard === null) return
    setPendingOperation(op)
  }

  const performOperation = (secondCardIndex: number) => {
    if (selectedCard === null || pendingOperation === null) return
    
    const firstCard = cards[selectedCard]
    const secondCard = cards[secondCardIndex]
    
    try {
      let result: number
      let expression: string
      
      switch (pendingOperation) {
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
            setSelectedCard(null)
            setPendingOperation(null)
            return
          }
          result = firstCard.value / secondCard.value
          expression = `(${firstCard.expression} ÷ ${secondCard.expression})`
          break
        default:
          return
      }
      
      // Remove only the first card and update the second card to be the result
      const newCards = cards.map((card, i) => {
        if (i === selectedCard) {
          return null // This card will be filtered out
        } else if (i === secondCardIndex) {
          // Update the second card to be the result
          return {
            value: result,
            expression: expression,
            isResult: true,
            position: card.position
          }
        } else {
          return card
        }
      }).filter(card => card !== null) as Card[]
      
      setCards(newCards)
      
      // Find the index of the result card in the new array
      const resultCardIndex = newCards.findIndex(card => card.position === secondCard.position)
      setSelectedCard(resultCardIndex)
      setPendingOperation(null)
      
      if (newCards.length === 1 && Math.abs(newCards[0].value - 24) < 0.001) {
        handleWin()
      } else if (newCards.length === 1 && Math.abs(newCards[0].value - 24) >= 0.001) {
        handleLoss()
      }
      
    } catch {
      showTemporaryMessage('❌ Invalid operation')
      setSelectedCard(null)
      setPendingOperation(null)
    }
  }

  const handleWin = () => {
    setScore(prev => prev + 1)
    setLevel(prev => prev + 1)
    setTimeout(() => startNewRound(), 1000)
  }

  const handleLoss = () => {
    setScore(0)
    setLevel(0)
    setTimeout(() => startNewRound(), 1000)
  }

  const showHint = () => {
    const solution = solver.getSolution(numbers)
    if (solution) {
      showTemporaryMessage(`💡 Solution: ${solution}`)
    } else {
      showTemporaryMessage('💡 No hint available')
    }
  }

  const showTemporaryMessage = (message: string) => {
    // Create temporary message element
    const messageEl = document.createElement('div')
    messageEl.textContent = message
    messageEl.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg z-50 border border-white/20'
    document.body.appendChild(messageEl)
    
    setTimeout(() => {
      if (document.body.contains(messageEl)) {
        document.body.removeChild(messageEl)
      }
    }, 3000)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // Create a 2x2 grid layout with proper positioning
  const renderCardAtPosition = (position: number) => {
    const cardIndex = cards.findIndex(card => card.position === position)
    
    if (cardIndex === -1) {
      return <div key={position} className="game-card empty"></div>
    }
    
    const card = cards[cardIndex]
    const isSelected = selectedCard === cardIndex
    const isResult = card.isResult
    const isPending = pendingOperation !== null && selectedCard === cardIndex
    
    let cardClass = 'game-card'
    if (isSelected) cardClass += ' selected'
    if (isResult) cardClass += ' result'
    if (isPending) cardClass += ' pending'
    
    return (
      <button 
        key={position}
        className={cardClass}
        onClick={() => selectCard(cardIndex)}
      >
        <div className="card-content">
          <span className="card-number">{card.value}</span>
          {isResult && <div className="card-expression">{card.expression}</div>}
        </div>
      </button>
    )
  }

  return (
    <div>
      {/* Header Section - Dark Blue Bar */}
      <div className="header-section">
        {/* Left - Home Button */}
        <Link href="/" className="header-icon">
          🏠
        </Link>
        
        {/* Center - Streak */}
        <div className="text-center">
          <div className="text-white text-lg font-semibold">Streak</div>
          <div className="bg-blue-800 rounded-lg px-4 py-2 mt-1">
            <div className="text-white text-2xl font-bold">{score}</div>
          </div>
        </div>
        
        {/* Right - Reset Button */}
        <button 
          onClick={resetRound}
          className="header-icon text-2xl"
        >
          ↻
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto p-4">

        {/* Game Board Section - 2x2 Grid */}
        <div className="game-board mb-6">
          {renderCardAtPosition(0)}
          {renderCardAtPosition(1)}
          {renderCardAtPosition(2)}
          {renderCardAtPosition(3)}
        </div>

        {/* Operator Section */}
        <div className="flex justify-center gap-4 mb-6">
          {[
            { op: '+', class: 'plus' },
            { op: '-', class: 'minus' },
            { op: '*', class: 'multiply' },
            { op: '/', class: 'divide' }
          ].map(({ op, class: className }) => (
            <button
              key={op}
              className={`operator-btn ${className} ${pendingOperation === op ? 'selected' : ''}`}
              onClick={() => addOperator(op)}
            >
              {op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : op}
            </button>
          ))}
        </div>

        {/* Timer Section */}
        <div className="flex justify-between items-center mb-6 text-gray-300">
          <div className="text-center">
            <div className="text-sm opacity-80">Total Time</div>
            <div className="text-lg font-bold">{formatTime(totalTimeElapsed)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm opacity-80">Round Time</div>
            <div className="text-lg font-bold">{formatTime(roundTimeElapsed)}</div>
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
    </div>
  )
}

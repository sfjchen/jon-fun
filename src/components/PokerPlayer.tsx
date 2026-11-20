import { memo } from 'react'
import type { Player } from '@/lib/poker'
import PokerChips from './PokerChips'

interface PokerPlayerProps {
  player: Player | null
  isCurrentPlayer: boolean
  isActionOn: boolean
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
  position: { top: string; left: string }
  timeRemaining?: number
  totalTime?: number
}

function PokerPlayer({
  player,
  isCurrentPlayer,
  isActionOn,
  isDealer,
  isSmallBlind,
  isBigBlind,
  position,
  timeRemaining,
  totalTime,
}: PokerPlayerProps) {
  if (!player) {
    return (
      <div className="absolute -translate-x-1/2 -translate-y-1/2 transform" style={position}>
        <div className="min-w-[80px] rounded-lg border-2 border-gray-600 bg-gray-800/50 p-2 text-center">
          <div className="text-xs text-gray-500">Empty</div>
        </div>
      </div>
    )
  }

  const progress =
    totalTime && timeRemaining !== undefined ? Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100)) : 100

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 transform ${isActionOn ? 'z-10' : ''}`}
      style={position}
    >
      <div
        className={`min-w-[100px] rounded-lg border-2 bg-gradient-to-br from-gray-800 to-gray-900 p-2 text-center transition-all sm:min-w-[120px] ${
          isActionOn
            ? 'scale-110 border-yellow-400 shadow-lg shadow-yellow-400/50'
            : isCurrentPlayer
              ? 'border-blue-400'
              : 'border-gray-600'
        }`}
      >
        {/* Timer progress bar */}
        {isActionOn && totalTime && timeRemaining !== undefined && (
          <div className="mb-1 h-1 overflow-hidden rounded-full bg-gray-700">
            <div
              className={`h-full transition-all ${
                timeRemaining < totalTime * 0.2
                  ? 'bg-red-500'
                  : timeRemaining < totalTime * 0.5
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Player name - highlighted if action is on them */}
        <div
          className={`text-sm font-semibold sm:text-base ${
            isActionOn ? 'font-bold text-yellow-300' : isCurrentPlayer ? 'text-blue-300' : 'text-white'
          }`}
        >
          {player.name}
          {isCurrentPlayer && <span className="ml-1 text-xs">(You)</span>}
        </div>

        {/* Status badges */}
        <div className="mt-1 flex flex-wrap justify-center gap-1">
          {isDealer && <span className="rounded bg-blue-600 px-1 text-xs text-white">D</span>}
          {isSmallBlind && <span className="rounded bg-purple-600 px-1 text-xs text-white">SB</span>}
          {isBigBlind && <span className="rounded bg-orange-600 px-1 text-xs text-white">BB</span>}
          {player.hasFolded && <span className="rounded bg-red-600 px-1 text-xs text-white">Fold</span>}
          {player.isAllIn && <span className="rounded bg-yellow-600 px-1 text-xs text-white">All-In</span>}
        </div>

        {/* Chips and bet */}
        <div className="mt-1 text-xs text-gray-300 sm:text-sm">
          <div>
            <PokerChips amount={player.chips} size="sm" />
          </div>
          {player.currentBet > 0 && (
            <div className="text-yellow-400">
              Bet: <PokerChips amount={player.currentBet} size="sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(PokerPlayer)

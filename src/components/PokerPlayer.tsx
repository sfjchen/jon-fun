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

export default function PokerPlayer({
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
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2"
        style={position}
      >
        <div className="bg-gray-800/50 border-2 border-gray-600 rounded-lg p-2 min-w-[80px] text-center">
          <div className="text-gray-500 text-xs">Empty</div>
        </div>
      </div>
    )
  }

  const progress = totalTime && timeRemaining !== undefined 
    ? Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100))
    : 100

  return (
    <div
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
        isActionOn ? 'z-10' : ''
      }`}
      style={position}
    >
      <div
        className={`bg-gradient-to-br from-gray-800 to-gray-900 border-2 rounded-lg p-2 min-w-[100px] sm:min-w-[120px] text-center transition-all ${
          isActionOn
            ? 'border-yellow-400 shadow-lg shadow-yellow-400/50 scale-110'
            : isCurrentPlayer
              ? 'border-blue-400'
              : 'border-gray-600'
        }`}
      >
        {/* Timer progress bar */}
        {isActionOn && totalTime && timeRemaining !== undefined && (
          <div className="mb-1 h-1 bg-gray-700 rounded-full overflow-hidden">
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
          className={`font-semibold text-sm sm:text-base ${
            isActionOn
              ? 'text-yellow-300 font-bold'
              : isCurrentPlayer
                ? 'text-blue-300'
                : 'text-white'
          }`}
        >
          {player.name}
          {isCurrentPlayer && <span className="text-xs ml-1">(You)</span>}
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-1 justify-center mt-1">
          {isDealer && (
            <span className="bg-blue-600 text-white text-xs px-1 rounded">D</span>
          )}
          {isSmallBlind && (
            <span className="bg-purple-600 text-white text-xs px-1 rounded">SB</span>
          )}
          {isBigBlind && (
            <span className="bg-orange-600 text-white text-xs px-1 rounded">BB</span>
          )}
          {player.hasFolded && (
            <span className="bg-red-600 text-white text-xs px-1 rounded">Fold</span>
          )}
          {player.isAllIn && (
            <span className="bg-yellow-600 text-white text-xs px-1 rounded">All-In</span>
          )}
        </div>

        {/* Chips and bet */}
        <div className="text-xs sm:text-sm text-gray-300 mt-1">
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


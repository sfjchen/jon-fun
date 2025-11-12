'use client'

import PokerChips from './PokerChips'
import type { Player } from '@/lib/poker'

interface PokerPlayerProps {
  player: Player
  isCurrentPlayer: boolean
  isActionOn: boolean
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
  position: { top?: string; right?: string; bottom?: string; left?: string }
}

export default function PokerPlayer({
  player,
  isCurrentPlayer,
  isActionOn,
  isDealer,
  isSmallBlind,
  isBigBlind,
  position,
}: PokerPlayerProps) {
  return (
    <div
      className={`absolute ${isActionOn ? 'ring-2 sm:ring-4 ring-yellow-400' : ''} ${
        isCurrentPlayer ? 'ring-1 sm:ring-2 ring-green-400' : ''
      } bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-4 border-2 ${
        isActionOn ? 'border-yellow-400' : 'border-white/20'
      } min-w-[100px] sm:min-w-[120px] max-w-[140px] transition-all text-xs sm:text-sm`}
      style={position}
    >
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="text-white font-semibold truncate">{player.name}</div>
          {isDealer && (
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">D</span>
          )}
          {isSmallBlind && (
            <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded">SB</span>
          )}
          {isBigBlind && (
            <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded">BB</span>
          )}
        </div>

        <div className="mb-2">
          <PokerChips amount={player.chips} size="sm" showLabel={false} />
        </div>

        {player.currentBet > 0 && (
          <div className="bg-red-600/50 rounded px-2 py-1 mb-1">
            <div className="text-white text-xs font-semibold">Bet: ${player.currentBet}</div>
          </div>
        )}

        {player.hasFolded && (
          <div className="bg-gray-800/50 rounded px-2 py-1 text-gray-400 text-xs">Folded</div>
        )}

        {player.isAllIn && !player.hasFolded && (
          <div className="bg-yellow-600/50 rounded px-2 py-1 text-white text-xs font-semibold">
            All-In
          </div>
        )}

        {!player.hasFolded && !player.isAllIn && player.currentBet === 0 && player.hasActed && (
          <div className="text-green-400 text-xs">Checked</div>
        )}
      </div>
    </div>
  )
}


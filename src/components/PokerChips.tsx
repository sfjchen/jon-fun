'use client'

interface PokerChipsProps {
  amount: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export default function PokerChips({ amount, size = 'md', showLabel = true }: PokerChipsProps) {
  const chipColors = [
    { value: 1, color: 'bg-white', border: 'border-gray-400' },
    { value: 5, color: 'bg-red-500', border: 'border-red-700' },
    { value: 10, color: 'bg-blue-500', border: 'border-blue-700' },
    { value: 25, color: 'bg-green-500', border: 'border-green-700' },
    { value: 100, color: 'bg-black', border: 'border-gray-800' },
    { value: 500, color: 'bg-purple-500', border: 'border-purple-700' },
    { value: 1000, color: 'bg-yellow-400', border: 'border-yellow-600' },
  ]

  const getChipDenominations = (total: number): Array<{ value: number; count: number }> => {
    const denominations = [1000, 500, 100, 25, 10, 5, 1]
    const result: Array<{ value: number; count: number }> = []
    let remaining = total

    for (const denom of denominations) {
      const count = Math.floor(remaining / denom)
      if (count > 0) {
        result.push({ value: denom, count })
        remaining -= count * denom
      }
    }

    return result
  }

  const chipSizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-base',
  }

  const denominations = getChipDenominations(amount)

  if (amount === 0) {
    return (
      <div className="flex items-center gap-1">
        <div className={`${chipSizeClasses[size]} rounded-full border-2 border-gray-600 bg-gray-800 flex items-center justify-center text-gray-500`}>
          $0
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {denominations.map(({ value, count }) => {
        const chipInfo = chipColors.find(c => c.value === value) || chipColors[0]
        if (!chipInfo) return null
        return (
          <div key={value} className="flex items-center gap-0.5">
            {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
              <div
                key={i}
                className={`${chipSizeClasses[size]} ${chipInfo.color} ${chipInfo.border} border-2 rounded-full flex items-center justify-center text-white font-bold shadow-lg`}
                style={{ marginLeft: i > 0 ? '-8px' : '0' }}
              >
                {value >= 100 ? `$${value / 100}k` : `$${value}`}
              </div>
            ))}
            {count > 5 && (
              <span className="text-xs text-white ml-1">+{count - 5}</span>
            )}
          </div>
        )
      })}
      {showLabel && (
        <span className="text-white font-semibold ml-2">${amount}</span>
      )}
    </div>
  )
}


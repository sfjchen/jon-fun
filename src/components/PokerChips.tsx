import { memo } from 'react'

interface PokerChipsProps {
  amount: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

function PokerChips({ amount, size = 'md', showLabel = false }: PokerChipsProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  return (
    <span className={sizeClasses[size]}>
      ${amount.toLocaleString()}
      {showLabel && amount !== 1 && ' chips'}
    </span>
  )
}

export default memo(PokerChips)


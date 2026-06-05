import { Suspense } from 'react'
import MentalObstacleCourse from '@/components/MentalObstacleCourse'

export default function Theme2MentalObstacleCoursePage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          Loading…
        </div>
      }
    >
      <MentalObstacleCourse />
    </Suspense>
  )
}

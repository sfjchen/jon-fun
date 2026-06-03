import type { Metadata } from 'next'
import UbiAiDashboard from '@/components/UbiAiDashboard'

export const metadata: Metadata = {
  title: 'UBI × AI utility explorer',
  description:
    'Literature-calibrated scenario model: universal basic income (UBI) social utility under AI job-security assumptions.',
}

export default function UbiAiPage() {
  return <UbiAiDashboard />
}

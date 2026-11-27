/**
 * Sends the old address of the sfjc.dev-bank daily to the publisher's edition, which is the ranked Orbs.
 */

import { redirect } from 'next/navigation'
import { validDay } from '@/lib/daily'

/**
 * Keeps the requested day in the new address.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams
  redirect('/games/orbs' + (validDay(d) ? '?d=' + d : ''))
}

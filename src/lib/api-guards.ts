/**
 * Request guards shared by API routes: the bearer check for Vercel cron jobs and a small per-address rate limit.
 */

import { NextResponse } from 'next/server'

/**
 * Tells whether a request carries the secret as a bearer token. Fails closed: an unset secret matches no request.
 */
export function hasBearer(req: Request, secret: string | undefined): boolean {
  return Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`
}

/**
 * Returns a 401 response unless the request is a Vercel cron call, which carries CRON_SECRET as its bearer token.
 */
export function cronDenied(req: Request): NextResponse | null {
  return hasBearer(req, process.env.CRON_SECRET) ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const windows = new Map<string, { start: number; count: number }>()

/**
 * Counts a request against its address and tells whether it went over max per minute for the named limit. The
 * counts live in 1 server instance, so this slows a burst from 1 client without being a hard global limit.
 */
export function rateLimited(req: Request, name: string, max: number): boolean {
  const key = `${name}:${req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local'}`
  const now = Date.now(), prev = windows.get(key)
  const rate = prev && now - prev.start < 60000 ? prev : { start: now, count: 0 }
  rate.count++
  windows.set(key, rate)
  if (windows.size > 10000) for (const [k, v] of windows) if (now - v.start > 60000) windows.delete(k)
  return rate.count > max
}

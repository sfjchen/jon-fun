/**
 * Edge gate for the public Veridian demo: caps AI calls per visitor before the /veridian rewrite forwards them.
 * Counts live in Supabase (`veridian_demo_hit`), so limits hold across server instances.
 */

import { NextResponse, type NextRequest } from 'next/server'

const CAPS = {
  analyze: { burst: 3, burstMin: 5, daily: 8, noun: 'analyses' },
  chat: { burst: 8, burstMin: 5, daily: 25, noun: 'messages' },
} as const

/**
 * Returns a 429 when the visitor is over a cap, else passes the request on to the rewrite.
 * Fails open when Supabase is unreachable so the demo never breaks on a counter outage.
 */
export async function proxy(req: NextRequest) {
  const route = req.nextUrl.pathname.endsWith('/analyze') ? 'analyze' : 'chat'
  const cap = CAPS[route]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (req.method !== 'POST' || !url || !svc) return NextResponse.next()

  /* sfjc.dev sits behind Cloudflare; Vercel sets x-forwarded-host itself, so cf-connecting-ip is trusted only there. */
  const h = req.headers
  const ip = (h.get('x-forwarded-host') === 'sfjc.dev' && h.get('cf-connecting-ip')) ||
      h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`veridian:${ip}`))
  const key = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')

  try {
    const res = await fetch(`${url}/rest/v1/rpc/veridian_demo_hit`, {
      method: 'POST',
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: key, p_route: route, p_burst: cap.burst, p_burst_min: cap.burstMin,
          p_daily: cap.daily }),
    })
    const hit = res.ok ? ((await res.json()) as string | null) : null
    if (!hit) return NextResponse.next()
    const label = hit === 'burst' ? `${cap.burst} ${cap.noun} per ${cap.burstMin} minutes` :
        `${cap.daily} ${cap.noun} per day`
    const wait = hit === 'burst' ? `${cap.burstMin} minutes` : 'tomorrow'
    return NextResponse.json({ error: `Public demo limit reached (${label}). Try again in ${wait}.` }, { status: 429 })
  } catch {
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/veridian/api/analyze', '/veridian/api/chat'],
}

import { test, expect } from '@playwright/test'

test.describe('Home Coming Soon API', () => {
  test('GET returns headline, intro, bullets[]', async ({ request }) => {
    const res = await request.get('/api/home/coming-soon')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { headline?: unknown; intro?: unknown; bullets?: unknown }
    expect(typeof body.headline).toBe('string')
    expect(body.headline!.length).toBeGreaterThan(0)
    expect(typeof body.intro).toBe('string')
    expect(Array.isArray(body.bullets)).toBe(true)
    expect((body.bullets as unknown[]).length).toBeGreaterThan(0)
  })

  test('POST invalid body returns 400', async ({ request }) => {
    const res = await request.post('/api/home/coming-soon', {
      data: { password: 'x' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(400)
  })

  test('POST wrong password returns 401 when edit secret is configured', async ({ request }) => {
    const res = await request.post('/api/home/coming-soon', {
      data: {
        password: '__playwright_wrong_password__',
        headline: 'Coming Soon',
        intro: 'Intro',
        bullets: ['One'],
      },
      headers: { 'Content-Type': 'application/json' },
    })
    const status = res.status()
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (status === 503 && typeof body.error === 'string' && body.error.includes('HOME_COMING_SOON_EDIT_SECRET')) {
      return
    }
    expect(status).toBe(401)
  })
})

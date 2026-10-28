/**
 * About page: who builds sfjc.dev and where to find more.
 * Uses the notebook PageShell chrome like every other inner page.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'About' }

const links = [
  { label: 'GitHub', href: 'https://github.com/sfjchen' },
  { label: 'Source for this site', href: 'https://github.com/sfjchen/jon-fun' },
]

/**
 * Renders a short first-person intro card with outbound links.
 */
export default function AboutPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-lora text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>
        About
      </h1>

      <div
        className="space-y-[30px] rounded-lg border p-[30px]"
        style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
      >
        <p style={{ color: 'var(--ink-text)' }}>
          I&apos;m Jonathan Chen, a student at Stanford. sfjc.dev is where I build games and tools I actually use,
          mostly for myself and my friends.
        </p>
        <p style={{ color: 'var(--ink-muted)' }}>
          Built with Next.js, TypeScript and Supabase, deployed on Vercel. Party games sync in realtime, and personal
          tools stay local-first with optional cloud sync.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
                style={{ color: 'var(--ink-accent)' }}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

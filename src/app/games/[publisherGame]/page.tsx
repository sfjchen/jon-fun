/**
 * Hosts the original publisher player on a dedicated sfjc.dev route.
 * Unknown games retain the standard missing-page response.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { COLLECTION_PLAYERS } from '@/lib/publisher-collection'

type Props = { params: Promise<{ publisherGame: string }> }
export const dynamicParams = false

/** Lists the publisher game routes at build time. */
export function generateStaticParams() {
  return COLLECTION_PLAYERS.map(({ id }) => ({ publisherGame: id }))
}

/** Labels each page with the publisher's title. */
export async function generateMetadata({ params }: Props) {
  const { publisherGame } = await params
  return { title: COLLECTION_PLAYERS.find((game) => game.id === publisherGame)?.title }
}

/** Opens the publisher's interface with access to its full-screen version and the shared result log. */
export default async function Page({ params }: Props) {
  const { publisherGame } = await params
  const game = COLLECTION_PLAYERS.find((game) => game.id === publisherGame)
  if (!game) notFound()
  return (
    <main className="mx-auto max-w-6xl space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-lora text-2xl font-bold">{game.title}</h1>
        <Link className="underline" href="/games/daily-collection">
          Daily games and result log
        </Link>
        <a href={game.site} className="underline" target="_blank" rel="noreferrer">
          Open on {new URL(game.site).host} ↗
        </a>
      </header>
      <iframe
        title={game.title + ' daily game'}
        src={game.site}
        allow="fullscreen; clipboard-write; autoplay"
        className="h-[82dvh] min-h-96 w-full rounded-xl border border-[var(--ink-border)]"
      />
    </main>
  )
}

import ConnectionsPlay from '@/components/connections/ConnectionsPlay'

export default async function Theme2ConnectionsPlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ConnectionsPlay basePath="/theme2/games/connections" idOrSlug={id} />
}

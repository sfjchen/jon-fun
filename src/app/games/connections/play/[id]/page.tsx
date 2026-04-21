import ConnectionsPlay from '@/components/connections/ConnectionsPlay'

export default async function ConnectionsPlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ConnectionsPlay basePath="/games/connections" idOrSlug={id} />
}

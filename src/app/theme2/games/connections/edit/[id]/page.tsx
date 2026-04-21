import ConnectionsEditor from '@/components/connections/ConnectionsEditor'

export default async function Theme2ConnectionsEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ConnectionsEditor basePath="/theme2/games/connections" editId={id} />
}

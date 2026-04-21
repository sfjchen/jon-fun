import ConnectionsEditor from '@/components/connections/ConnectionsEditor'

export default async function ConnectionsEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ConnectionsEditor basePath="/games/connections" editId={id} />
}

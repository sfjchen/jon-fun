import { ReaderClientPage } from '@/components/reader/ReaderClientPage'

export default async function EReaderChapterPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>
}) {
  const { bookId, chapterId } = await params
  return <ReaderClientPage bookId={bookId} chapterId={chapterId} routeBase="/games/e-reader" />
}

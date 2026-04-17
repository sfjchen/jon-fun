import { ReaderClientPage } from '@/components/reader/ReaderClientPage'

export default async function Theme2EReaderChapterPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>
}) {
  const { bookId, chapterId } = await params
  return <ReaderClientPage bookId={bookId} chapterId={chapterId} routeBase="/theme2/games/e-reader" />
}

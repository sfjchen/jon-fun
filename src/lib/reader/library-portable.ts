import type { ReaderPublication } from '@/lib/reader/types'

export const READER_PORTABLE_LIBRARY_VERSION = 1 as const

export type PortableReaderLibrary = {
  version: typeof READER_PORTABLE_LIBRARY_VERSION
  exportedAt: string
  publications: ReaderPublication[]
}

export function stringifyPortableLibrary(publications: ReaderPublication[]): string {
  const payload: PortableReaderLibrary = {
    version: READER_PORTABLE_LIBRARY_VERSION,
    exportedAt: new Date().toISOString(),
    publications,
  }
  return JSON.stringify(payload, null, 2)
}

export function parsePortableLibrary(json: string): ReaderPublication[] {
  let data: Partial<PortableReaderLibrary>
  try {
    data = JSON.parse(json) as Partial<PortableReaderLibrary>
  } catch {
    throw new Error('Not valid JSON.')
  }
  if (data.version !== READER_PORTABLE_LIBRARY_VERSION || !Array.isArray(data.publications)) {
    throw new Error('Invalid portable library file (expected version 1 and publications array).')
  }
  for (const p of data.publications) {
    if (typeof p?.id !== 'string' || typeof p?.title !== 'string' || !Array.isArray(p?.chapters)) {
      throw new Error('Invalid publication entry in library file.')
    }
  }
  return data.publications as ReaderPublication[]
}

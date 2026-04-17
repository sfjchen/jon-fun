import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const WORKER_REL = 'legacy/build/pdf.worker.mjs'

/**
 * pdf.js falls back to a "fake worker" that dynamically imports `pdf.worker.mjs`.
 * That import must resolve to a real file. After npm hoisting, the path nested under
 * `pdf-parse/node_modules/pdfjs-dist` may be missing on Vercel (`/var/task`), so we
 * point `GlobalWorkerOptions.workerSrc` at an existing `legacy/build/pdf.worker.mjs`
 * (prefer top-level `pdfjs-dist`).
 *
 * On Vercel, Next.js output file tracing can omit worker files unless listed in
 * `next.config.mjs` → `outputFileTracingIncludes` for this API route.
 */
export function getPdfWorkerSrcForNode(): string {
  const tryPaths: string[] = []

  try {
    const req = createRequire(import.meta.url)
    const pkgJson = req.resolve('pdfjs-dist/package.json')
    tryPaths.push(path.join(path.dirname(pkgJson), WORKER_REL))
  } catch {
    // resolution failed (e.g. unusual bundle layout)
  }

  const cwd = process.cwd()
  tryPaths.push(
    path.join(cwd, 'node_modules', 'pdfjs-dist', WORKER_REL),
    path.join(cwd, 'node_modules', 'pdf-parse', 'node_modules', 'pdfjs-dist', WORKER_REL),
  )

  for (const p of tryPaths) {
    if (existsSync(p)) {
      return pathToFileURL(p).href
    }
  }
  throw new Error(
    'pdf.worker.mjs not found. Add dependency "pdfjs-dist" (same major as pdf-parse), run npm install, and ensure Vercel includes pdfjs-dist in the server trace (see next.config.mjs outputFileTracingIncludes).',
  )
}

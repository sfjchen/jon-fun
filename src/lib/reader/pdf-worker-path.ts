import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * pdf.js falls back to a "fake worker" that dynamically imports `pdf.worker.mjs`.
 * That import must resolve to a real file. After npm hoisting, the path nested under
 * `pdf-parse/node_modules/pdfjs-dist` may be missing on Vercel (`/var/task`), so we
 * point `GlobalWorkerOptions.workerSrc` at an existing `legacy/build/pdf.worker.mjs`
 * (prefer top-level `pdfjs-dist`).
 */
export function getPdfWorkerSrcForNode(): string {
  const tryPaths: string[] = []
  try {
    const req = createRequire(import.meta.url)
    const pkgJson = req.resolve('pdfjs-dist/package.json')
    tryPaths.push(path.join(path.dirname(pkgJson), 'legacy', 'build', 'pdf.worker.mjs'))
  } catch {
    // resolution failed (e.g. unusual bundle layout)
  }
  const cwd = process.cwd()
  tryPaths.push(
    path.join(cwd, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'),
    path.join(cwd, 'node_modules', 'pdf-parse', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'),
  )
  for (const p of tryPaths) {
    if (existsSync(p)) {
      return pathToFileURL(p).href
    }
  }
  throw new Error(
    'pdf.worker.mjs not found. Add dependency "pdfjs-dist" (same major as pdf-parse) or reinstall node_modules.',
  )
}

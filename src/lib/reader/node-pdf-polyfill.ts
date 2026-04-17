import CSSMatrix from 'dommatrix'

/**
 * pdf.js (via pdf-parse) expects browser geometry APIs. Node has no `DOMMatrix` unless polyfilled.
 */
export function installNodePdfPolyfills(): void {
  const g = globalThis as typeof globalThis & {
    DOMMatrix?: typeof CSSMatrix
    DOMMatrixReadOnly?: typeof CSSMatrix
  }
  if (typeof g.DOMMatrix === 'undefined') {
    g.DOMMatrix = CSSMatrix
  }
  if (typeof g.DOMMatrixReadOnly === 'undefined') {
    g.DOMMatrixReadOnly = CSSMatrix
  }
}

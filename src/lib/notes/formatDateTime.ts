/**
 * Shared note timestamp formatter used by the notes top bar and exports.
 */

/**
 * Returns an ISO timestamp as a short local date and time, such as "Nov 9, 2026, 3:05 PM".
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

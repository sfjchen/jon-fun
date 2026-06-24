import { SFJC_ADMIN_DEVICE_IDS } from '@/data/sfjc-admin-devices'

export const NOTES_AI_ACCESS_DENIED =
  "Notes AI lookup requires Jon's sync password. Open Sync & backup → enter the sync password → Save & Sync."

/** Server env: SFJC_SYNC_PASSWORD (set on Vercel/Render — not committed). */
export function ownerSyncPassword(): string {
  return process.env.SFJC_SYNC_PASSWORD?.trim() ?? ''
}

export function isValidSyncPassword(password: string | undefined | null): boolean {
  const expected = ownerSyncPassword()
  if (!expected) {
    return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  }
  return (password ?? '').trim() === expected
}

export function isAdminDeviceId(deviceId: string | undefined | null): boolean {
  const id = (deviceId ?? '').trim()
  return id.length > 0 && SFJC_ADMIN_DEVICE_IDS.has(id)
}

/** Returns error message when AI access denied, else null. */
export function assertNotesAiAccess(syncPassword?: string | null): string | null {
  if (isValidSyncPassword(syncPassword)) return null
  return NOTES_AI_ACCESS_DENIED
}

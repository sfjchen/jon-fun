import {
  SFJC_ADMIN_DEVICE_IDS,
  SFJC_OWNER_SYNC_PASSWORD_USER_ID,
} from '@/data/sfjc-admin-devices'

export const NOTES_AI_ACCESS_DENIED =
  "Notes AI lookup requires Jon's sync password. Open Sync & backup → enter the sync password → Save & Sync."

export const NOTES_AI_DEVICE_DENIED =
  'Notes AI is limited to registered sfjc.dev admin devices.'

export const NOTES_VAULT_ACCESS_DENIED = 'Invalid sync password for owner vault.'

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

function ownerVaultProtected(): boolean {
  return ownerSyncPassword().length > 0
}

/** Returns error message when owner vault access denied, else null. */
export function assertOwnerVaultAccess(
  userId: string | undefined | null,
  syncPassword?: string | null,
): string | null {
  if (!ownerVaultProtected()) return null
  if ((userId ?? '').trim() !== SFJC_OWNER_SYNC_PASSWORD_USER_ID) return null
  if (isValidSyncPassword(syncPassword)) return null
  return NOTES_VAULT_ACCESS_DENIED
}

/** Returns error message when AI access denied, else null. */
export function assertNotesAiAccess(
  syncPassword?: string | null,
  deviceUserId?: string | null,
): string | null {
  if (!ownerVaultProtected()) {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') return null
    return NOTES_AI_ACCESS_DENIED
  }
  if (!isValidSyncPassword(syncPassword)) return NOTES_AI_ACCESS_DENIED
  if (!isAdminDeviceId(deviceUserId)) return NOTES_AI_DEVICE_DENIED
  return null
}

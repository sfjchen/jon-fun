import {
  SFJC_ADMIN_DEVICE_IDS,
  SFJC_OWNER_SYNC_PASSWORD_USER_ID,
} from '@/data/sfjc-admin-devices'

export const NOTES_AI_ACCESS_DENIED =
  'Notes AI is private to the site owner (needs the owner sync password). Writing, tables, search and export ' +
    'still work locally in this browser.'

export const NOTES_AI_DEVICE_DENIED =
  'Notes AI is private to the site owner\'s registered devices. Everything else still works locally.'

export const NOTES_VAULT_ACCESS_DENIED = 'Invalid sync password for owner vault.'

export const NOTES_VAULT_DEVICE_DENIED =
  'Owner vault requires a registered sfjc.dev admin device.'

export const READER_SHELF_OWNER_DENIED =
  'Only the site owner can change or delete shared shelf books. Reading and local export still work.'

/** Server env: SFJC_SYNC_PASSWORD (set on Vercel — not committed). */
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

/** Returns error message when owner vault read (GET) denied, else null. Password only — no device gate. */
export function assertOwnerVaultReadAccess(
  userId: string | undefined | null,
  syncPassword?: string | null,
): string | null {
  if (!ownerVaultProtected()) return null
  if ((userId ?? '').trim() !== SFJC_OWNER_SYNC_PASSWORD_USER_ID) return null
  if (!isValidSyncPassword(syncPassword)) return NOTES_VAULT_ACCESS_DENIED
  return null
}

/** Returns error message when owner vault write denied, else null. Password + admin device. */
export function assertOwnerVaultAccess(
  userId: string | undefined | null,
  syncPassword?: string | null,
  deviceUserId?: string | null,
): string | null {
  const readDenied = assertOwnerVaultReadAccess(userId, syncPassword)
  if (readDenied) return readDenied
  if (!ownerVaultProtected()) return null
  if ((userId ?? '').trim() !== SFJC_OWNER_SYNC_PASSWORD_USER_ID) return null
  if (!isAdminDeviceId(deviceUserId)) return NOTES_VAULT_DEVICE_DENIED
  return null
}

/**
 * Reports whether a request carries the owner sync password from a registered admin device.
 * Without SFJC_SYNC_PASSWORD set, only development and test builds count as owner.
 */
export function isOwnerRequest(syncPassword?: string | null, deviceUserId?: string | null): boolean {
  if (!ownerVaultProtected()) return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  return isValidSyncPassword(syncPassword) && isAdminDeviceId(deviceUserId)
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

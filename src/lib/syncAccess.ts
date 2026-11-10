/**
 * Server-side sync access shared by Daily Learn, Notes and the Reader shelf.
 * The sync key is the account: whoever sends it reads and writes its rows. Device-only data lives under the
 * device ID. The owner key unlocks owner-only features.
 */
import { supabaseAdmin } from '@/lib/supabase'

export const OWNER_SYNC_KEY = 'sfjc'
export const SYNC_DEVICES_TABLE = 'sync_devices'
export const OWNER_ONLY = 'Only the site owner\'s sync key can do this. Everything else still works locally.'

export type SyncDevice = { device_id: string; sync_key: string | null; label: string; last_seen: string }

/**
 * Maps the retired owner password (still in old browsers' storage) to the owner key, so those browsers land in
 * the owner account.
 */
export function canonicalKey(key: string | null | undefined): string {
  const k = (key ?? '').trim()
  const legacy = process.env.SFJC_SYNC_PASSWORD?.trim()
  return legacy && k === legacy ? OWNER_SYNC_KEY : k
}

/**
 * Fetches a device's link row, or null when the device has never linked a key.
 */
export async function getDevice(deviceId: string | null | undefined): Promise<SyncDevice | null> {
  const id = (deviceId ?? '').trim()
  if (!id) return null
  const { data } = await supabaseAdmin.from(SYNC_DEVICES_TABLE).select('*').eq('device_id', id).maybeSingle()
  return (data as SyncDevice | null) ?? null
}

/**
 * Resolves the canonical user_id for a request, or a 400 error when it is missing.
 */
export function resolveSyncUser(
  userId: string | null | undefined,
): { uid: string } | { error: string; status: number } {
  const uid = canonicalKey(userId)
  return uid ? { uid } : { error: 'userId required', status: 400 }
}

/** Reports whether the request carries the owner key (gates Notes AI and Reader shelf edits). */
export function isOwnerKey(userId: string | null | undefined): boolean {
  return canonicalKey(userId) === OWNER_SYNC_KEY
}

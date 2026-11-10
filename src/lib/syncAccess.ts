/**
 * Server-side sync access shared by Daily Learn, Notes and the Reader shelf.
 * A sync key's rows open only to devices linked to that key and approved from an already approved device,
 * so a guessed or leaked key alone reads nothing. Device-only data (userId equal to the caller's own device ID)
 * stays open to that device.
 */
import { supabaseAdmin } from '@/lib/supabase'

export const OWNER_SYNC_KEY = 'sfjc'
export const SYNC_DEVICES_TABLE = 'sync_devices'
export const DEVICE_PENDING =
  'This device is waiting for approval. Approve it from a device already linked to this sync key.'
export const OWNER_ONLY = 'Only the site owner\'s approved devices can do this. Everything else still works locally.'

export type SyncDevice = {
  device_id: string
  sync_key: string | null
  approved: boolean
  label: string
  created_at: string
  last_seen: string
}

/**
 * Maps the retired owner password (still in old browsers' storage) to the owner key, so those browsers join the
 * owner account and wait for approval like any new device.
 */
export function canonicalKey(key: string | null | undefined): string {
  const k = (key ?? '').trim()
  const legacy = process.env.SFJC_SYNC_PASSWORD?.trim()
  return legacy && k === legacy ? OWNER_SYNC_KEY : k
}

/**
 * Fetches a device's link row, or null when the device has never linked.
 */
export async function getDevice(deviceId: string | null | undefined): Promise<SyncDevice | null> {
  const id = (deviceId ?? '').trim()
  if (!id) return null
  const { data } = await supabaseAdmin.from(SYNC_DEVICES_TABLE).select('*').eq('device_id', id).maybeSingle()
  return (data as SyncDevice | null) ?? null
}

/**
 * Resolves which user_id a request may use. Returns the canonical id, or an error with its HTTP status when the
 * device is not approved for that sync key.
 */
export async function resolveSyncUser(
  userId: string | null | undefined,
  deviceId: string | null | undefined,
): Promise<{ uid: string } | { error: string; status: number }> {
  const uid = canonicalKey(userId)
  const did = (deviceId ?? '').trim()
  if (!uid) return { error: 'userId required', status: 400 }
  if (uid === did) return { uid }
  const dev = await getDevice(did)
  if (dev?.approved && dev.sync_key === uid) return { uid }
  return { error: DEVICE_PENDING, status: 403 }
}

/**
 * Reports whether the device is an approved device of the owner key (gates Notes AI and Reader shelf edits).
 */
export async function isOwnerDevice(deviceId: string | null | undefined): Promise<boolean> {
  const dev = await getDevice(deviceId)
  return Boolean(dev?.approved && dev.sync_key === OWNER_SYNC_KEY)
}

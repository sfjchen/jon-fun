/**
 * Notes device helpers on top of the shared sync identity: session ids, display names and the last-edited-by
 * stamp on note metadata.
 */
import { genUuid, getDeviceId, getDeviceLabel, SYNC_IDENTITY_CHANGED } from '@/lib/syncIdentity'

export { getDeviceId, SYNC_IDENTITY_CHANGED as NOTES_DEVICE_LABEL_CHANGED }

/** Returns a fresh session id. */
export function createEmptySessionId(): string {
  return genUuid()
}

/**
 * Returns a friendly device name: this browser's custom label, else a short id.
 */
export function getDeviceDisplayName(deviceId?: string): string {
  const id = deviceId ?? getDeviceId()
  if (id === getDeviceId() && getDeviceLabel()) return getDeviceLabel()
  return `Device ${id.slice(0, 8)}`
}

/**
 * Stamps this device's id and name onto note metadata.
 */
export function stampDeviceOnMetadata<T extends { lastDeviceId?: string; lastDeviceLabel?: string }>(
  metadata: T | undefined,
): T & { lastDeviceId: string; lastDeviceLabel: string } {
  const id = getDeviceId()
  return { ...(metadata ?? ({} as T)), lastDeviceId: id, lastDeviceLabel: getDeviceDisplayName(id) }
}

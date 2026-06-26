/** Per-browser device UUID + friendly label (separate from shared vault user id). */

import { adminDeviceLabel } from '@/data/sfjc-admin-devices'

export const NOTES_USER_ID_KEY = 'notes_user_id'
const DEVICE_LABEL_KEY = 'notes_device_label'
export const NOTES_DEVICE_LABEL_CHANGED = 'notes-device-label-changed'

function genUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(NOTES_USER_ID_KEY)
  if (!id) {
    id = genUuid()
    localStorage.setItem(NOTES_USER_ID_KEY, id)
  }
  return id
}

export function getDeviceId(): string {
  return getOrCreateUserId()
}

export function createEmptySessionId(): string {
  return genUuid()
}

export function getCustomDeviceLabel(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(DEVICE_LABEL_KEY)?.trim() ?? ''
}

export function setCustomDeviceLabel(label: string): void {
  if (typeof window === 'undefined') return
  const t = label.trim()
  if (t) localStorage.setItem(DEVICE_LABEL_KEY, t)
  else localStorage.removeItem(DEVICE_LABEL_KEY)
  window.dispatchEvent(new Event(NOTES_DEVICE_LABEL_CHANGED))
}

/** Friendly name: custom label → registered admin name → short id. */
export function getDeviceDisplayName(deviceId?: string): string {
  const id = deviceId ?? getOrCreateUserId()
  if (id === getOrCreateUserId()) {
    const custom = getCustomDeviceLabel()
    if (custom) return custom
  }
  const admin = adminDeviceLabel(id)
  if (admin) return admin
  return `Device ${id.slice(0, 8)}`
}

export function formatDeviceShort(deviceId?: string): string {
  const id = deviceId ?? getOrCreateUserId()
  return `${getDeviceDisplayName(id)} · ${id.slice(0, 8)}…`
}

export function stampDeviceOnMetadata<T extends { lastDeviceId?: string; lastDeviceLabel?: string }>(
  metadata: T | undefined,
): T & { lastDeviceId: string; lastDeviceLabel: string } {
  const id = getOrCreateUserId()
  return {
    ...(metadata ?? ({} as T)),
    lastDeviceId: id,
    lastDeviceLabel: getDeviceDisplayName(id),
  }
}

/** Jon's registered sfjc.dev admin devices (device UUID in localStorage). */
export const SFJC_ADMIN_DEVICES = [
  {
    id: 'REDACTED-DEVICE-ID',
    label: "Jonathan's iPhone",
  },
  {
    id: 'REDACTED-DEVICE-ID',
    label: "Jonathan's Macbook Air",
  },
  {
    id: '81a932d2-de6b-42a5-a2b5-274a9141c668',
    label: "Jonathan's Work Laptop",
  },
] as const

export const SFJC_OWNER_SYNC_PASSWORD_USER_ID = 'REDACTED'

export const SFJC_ADMIN_DEVICE_IDS = new Set<string>(SFJC_ADMIN_DEVICES.map((d) => d.id))

export function adminDeviceLabel(deviceId: string): string | null {
  const id = deviceId.trim()
  for (const d of SFJC_ADMIN_DEVICES) {
    if (d.id === id) return d.label
  }
  return null
}

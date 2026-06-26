/** Jon's registered sfjc.dev admin devices (device UUID in localStorage). */
export const SFJC_ADMIN_DEVICES = [
  {
    id: '1d6c04b1-42d0-44ed-bcd1-c9b48ffcaffc',
    label: "Jonathan's iPhone",
  },
  {
    id: 'd6e8099c-7873-40e9-88f5-e6601001ec0a',
    label: "Jonathan's Macbook Air",
  },
  {
    id: 'cc19ad2e-2ee4-4156-8b50-cf0d9c74fbf7',
    label: "Jonathan's Work Laptop",
  },
] as const

export const SFJC_OWNER_SYNC_PASSWORD_USER_ID = 'MLpnko#12'

export const SFJC_ADMIN_DEVICE_IDS = new Set<string>(SFJC_ADMIN_DEVICES.map((d) => d.id))

export function adminDeviceLabel(deviceId: string): string | null {
  const id = deviceId.trim()
  for (const d of SFJC_ADMIN_DEVICES) {
    if (d.id === id) return d.label
  }
  return null
}

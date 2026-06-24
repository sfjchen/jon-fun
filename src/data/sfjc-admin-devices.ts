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
    id: '81a932d2-de6b-42a5-a2b5-274a9141c668',
    label: "Jonathan's Work Laptop",
  },
] as const

export const SFJC_OWNER_SYNC_PASSWORD_USER_ID = 'MLpnko#12'

export const SFJC_ADMIN_DEVICE_IDS = new Set<string>(SFJC_ADMIN_DEVICES.map((d) => d.id))

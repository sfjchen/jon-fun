import { getOrCreateUserId, getSyncKey } from '@/lib/notes/storage'

/** Credentials sent with owner-gated API routes (Notes AI). */
export function notesSyncCredentials(): { syncPassword: string; deviceUserId: string } {
  return {
    syncPassword: getSyncKey(),
    deviceUserId: getOrCreateUserId(),
  }
}

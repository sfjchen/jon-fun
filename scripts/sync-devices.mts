/**
 * Lists and approves sync devices from the terminal, for when no approved browser is at hand.
 * Run: npm run sync:devices                  (lists every device of the owner key)
 *      npm run sync:devices -- approve <id>  (approves 1 device by id prefix, or "pending" for all waiting)
 *      npm run sync:devices -- remove <id>   (unlinks 1 device by id prefix)
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from '@supabase/supabase-js'

const KEY = process.env.SYNC_KEY ?? 'sfjc'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})
const [cmd, arg = ''] = process.argv.slice(2)

const { data, error } = await db
  .from('sync_devices')
  .select('device_id, label, approved, last_seen')
  .eq('sync_key', KEY)
  .order('last_seen', { ascending: false })
if (error) throw error
const devs = data ?? []

if (cmd === 'approve' || cmd === 'remove') {
  const hits = devs.filter((d) => (arg === 'pending' ? !d.approved : arg && d.device_id.startsWith(arg)))
  if (!hits.length) {
    console.log(arg === 'pending' ? 'No devices waiting. Open sfjc.dev on the browser first.' : `No device matches "${arg}"`)
    process.exit(1)
  }
  for (const d of hits) {
    const patch = cmd === 'approve' ? { approved: true } : { approved: false, sync_key: null }
    const { error: e } = await db.from('sync_devices').update(patch).eq('device_id', d.device_id)
    if (e) throw e
    console.log(`${cmd}d ${d.device_id.slice(0, 8)} ${d.label}`)
  }
} else {
  for (const d of devs) {
    console.log(`${d.approved ? 'approved' : 'PENDING '}  ${d.device_id.slice(0, 8)}  ${d.last_seen.slice(0, 16)}  ${d.label}`)
  }
  if (!devs.length) console.log(`No devices linked to "${KEY}" yet`)
}

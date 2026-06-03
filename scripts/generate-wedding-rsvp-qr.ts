/**
 * Generate RSVP QR code PNG for print inserts.
 * Usage: npm run wedding:rsvp-qr
 * Optional: WEDDING_SITE_URL=https://sfjc.dev/wedding/madelyn-patrick npm run wedding:rsvp-qr
 */
import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'

const baseUrl = process.env.WEDDING_SITE_URL ?? 'https://sfjc.dev/wedding/madelyn-patrick'
const rsvpUrl = `${baseUrl.replace(/\/$/, '')}#rsvp`
const outDir = path.join(process.cwd(), 'public/images/wedding/madelyn-patrick')
const outFile = path.join(outDir, 'rsvp-qr.png')

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  await QRCode.toFile(outFile, rsvpUrl, {
    type: 'png',
    width: 512,
    margin: 2,
    color: { dark: '#1a1a1a', light: '#faf6f0' },
  })
  console.log(`Wrote ${outFile}`)
  console.log(`URL: ${rsvpUrl}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/** Capture the public current-day answer review, with no game submissions or AI service. */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
async function main() {
  const { captureKrillion } = await import('../src/lib/daily/krillion')
  const result = await captureKrillion()
  console.log('Stored official review', result.date, `${result.prompts.length} prompts`)
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Capture failed')
  process.exitCode = 1
})

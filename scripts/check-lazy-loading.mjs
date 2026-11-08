// FE-18: a customer who never visits /admin downloads no admin-area code. Reads esbuild's metafile from
// `ng build --stats-json` and follows every import a customer can trigger: static imports from the entry point and
// lazy chunks, except the lazy load of an admin chunk. None of the chunks reached may contain admin code.
import { readFile } from 'node:fs/promises'

export const ADMIN_CODE = /^src\/app\/(shell\/admin|[^/]+\/feature\/admin)\//

export function checkMetafile(metafile) {
  const outputs = Object.fromEntries(Object.entries(metafile.outputs).filter(([file]) => file.endsWith('.js')))
  const hasAdminCode = (file) => Object.keys(outputs[file]?.inputs ?? {}).some((input) => ADMIN_CODE.test(input))
  const isAdminEntry = (file) => ADMIN_CODE.test(outputs[file]?.entryPoint ?? '')

  const main = Object.keys(outputs).find((file) => outputs[file].entryPoint === 'src/main.ts')
  if (!main) return { adminChunks: [], problems: ['No chunk for src/main.ts in the metafile'] }

  const reached = new Set()
  const pending = [main]
  while (pending.length > 0) {
    const file = pending.pop()
    if (reached.has(file)) continue
    reached.add(file)
    for (const { path, kind } of outputs[file]?.imports ?? []) {
      if (!path.endsWith('.js')) continue
      if (kind === 'dynamic-import' && isAdminEntry(path)) continue // only loaded when /admin is opened
      pending.push(path)
    }
  }

  const adminChunks = Object.keys(outputs).filter(hasAdminCode)
  const problems = [...reached].filter(hasAdminCode).map((file) => `${file} is loaded in the customer area but contains admin code`)
  if (adminChunks.length === 0) problems.push('No admin chunk found: is the admin area still lazily loaded?')
  return { adminChunks, problems }
}

if (process.argv[1]?.endsWith('check-lazy-loading.mjs')) {
  const metafile = JSON.parse(
    await readFile(new URL('../dist/branch-appointments-frontend/browser-stats.json', import.meta.url), 'utf8'),
  )
  const { adminChunks, problems } = checkMetafile(metafile)
  if (problems.length > 0) {
    console.error(`FE-18 lazy loading check failed:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`FE-18 lazy loading check passed (${adminChunks.length} admin chunk(s), none reachable from the customer area)`)
}

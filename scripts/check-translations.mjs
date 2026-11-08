// Every literal translation key in the source exists in public/i18n/en.json, so no screen shows a raw key. Keys built
// at run time ('admin.actions.' + action) are not checked here.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const en = JSON.parse(readFileSync(join(root, 'public/i18n/en.json'), 'utf8'))
const NAMESPACES = Object.keys(en).join('|')
const KEY = new RegExp(`'((?:${NAMESPACES})\\.[A-Za-z0-9_.]*[A-Za-z0-9_])'`, 'g')

function* sources(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* sources(path)
    else if (path.endsWith('.ts') && !path.endsWith('.spec.ts') && !path.endsWith('api.generated.ts')) yield path
  }
}

const lookup = (key) => key.split('.').reduce((node, part) => node?.[part], en)
const missing = new Set()
for (const file of sources(join(root, 'src/app'))) {
  for (const [, key] of readFileSync(file, 'utf8').matchAll(KEY)) {
    if (typeof lookup(key) !== 'string') missing.add(key)
  }
}

if (missing.size > 0) {
  console.error(`Translation keys missing from public/i18n/en.json:\n  ${[...missing].sort().join('\n  ')}`)
  process.exit(1)
}
console.log('All translation keys found')

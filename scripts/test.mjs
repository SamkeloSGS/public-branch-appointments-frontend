// Runs the unit tests with the browser in a different zone from every branch (America/New_York), so a time shown in
// the browser's zone instead of the branch's fails a test (FE-16). Extra arguments go to `ng test`.
import { spawnSync } from 'node:child_process'

const result = spawnSync('npx', ['ng', 'test', '--watch=false', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, TZ: 'America/New_York' },
})
process.exit(result.status ?? 1)

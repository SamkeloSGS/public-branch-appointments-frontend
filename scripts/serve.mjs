// Starts `ng serve` from the project folder, wherever it is launched from (e.g. a preview tool in another folder).
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const child = spawn('npx', ['ng', 'serve', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', shell: true })
child.on('exit', (code) => process.exit(code ?? 0))

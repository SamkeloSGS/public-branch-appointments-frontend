// FE-1: the lint step rejects imports that break the architecture rules of spec section 3. Each case lints a line of
// code as if it were in the given file, using the project's own ESLint configuration.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'

const eslint = new ESLint({ cwd: fileURLToPath(new URL('..', import.meta.url)) })

async function errorsFor(filePath, code) {
  const [result] = await eslint.lintText(`${code}\nexport const x = 1\n`, { filePath })
  return result.messages
    .filter((message) => message.severity === 2)
    .map((message) => message.ruleId)
    .filter((rule) => rule === 'boundaries/dependencies' || rule === 'no-restricted-imports')
}

const rejected = [
  ['FE-1 a domain imports another domain only through its index.ts',
    'src/app/booking/feature/x.ts', "import { ProfileStore } from '../../customer/data/profile.store'"],
  ['FE-1 shared imports from no domain',
    'src/app/shared/util/x.ts', "import { bookingRoutes } from '../../booking'"],
  ['FE-1 ui imports no data layer',
    'src/app/booking/ui/x.ts', "import { BookingApi } from '../data/booking-api'"],
  ['FE-1 ui uses no router or HTTP',
    'src/app/booking/ui/x.ts', "import { Router } from '@angular/router'"],
  ['FE-1 model imports nothing outside model',
    'src/app/booking/model/x.ts', "import { call } from '../../shared/util/http'"],
  ['FE-1 data imports no feature',
    'src/app/booking/data/x.ts', "import { ConfirmStep } from '../feature/confirm-step'"],
  ['FE-1 identity imports no other domain',
    'src/app/identity/data/x.ts', "import { BranchCatalog } from '../../branch-management'"],
  ['FE-1 the entry file never exposes feature pages',
    'src/app/booking/index.ts', "export { ConfirmStep } from './feature/confirm-step'"],
  ['FE-18 customer code never imports admin code statically',
    'src/app/shell/customer/x.ts', "import { AdminShell } from '../admin/admin-shell'"],
]

const accepted = [
  ['FE-1 a feature uses another domain through its entry file',
    'src/app/booking/feature/x.ts', "import { BranchCatalog } from '../../branch-management'"],
  ['FE-1 every domain may use identity',
    'src/app/customer/data/x.ts', "import { Session } from '../../identity'"],
  ['FE-1 ui uses its model and shared ui',
    'src/app/booking/ui/x.ts', "import { ZoneNote } from '../../shared/ui/zone-note'\nimport { isChangeable } from '../model/appointment'"],
]

describe('architecture boundaries', () => {
  for (const [name, file, code] of rejected) {
    it(name, async () => assert.notDeepEqual(await errorsFor(file, code), [], `${file}: ${code} was not rejected`))
  }
  for (const [name, file, code] of accepted) {
    it(name, async () => assert.deepEqual(await errorsFor(file, code), []))
  }
})

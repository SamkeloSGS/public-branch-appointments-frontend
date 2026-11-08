// FE-18: the build check finds admin code that a customer would download.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkMetafile } from '../scripts/check-lazy-loading.mjs'

const chunk = (inputs, imports = [], entryPoint) => ({
  inputs: Object.fromEntries(inputs.map((input) => [input, {}])),
  imports,
  ...(entryPoint ? { entryPoint } : {}),
})

describe('lazy loading check', () => {
  it('FE-18 passes when admin code is only behind the lazy /admin route', () => {
    const { problems } = checkMetafile({
      outputs: {
        'main.js': chunk(['src/main.ts'], [{ path: 'admin.js', kind: 'dynamic-import' }], 'src/main.ts'),
        'admin.js': chunk(['src/app/shell/admin/admin.routes.ts'], [], 'src/app/shell/admin/admin.routes.ts'),
      },
    })
    assert.deepEqual(problems, [])
  })

  it('FE-18 fails when a customer chunk imports admin code statically', () => {
    const { problems } = checkMetafile({
      outputs: {
        'main.js': chunk(['src/main.ts'], [{ path: 'shared.js', kind: 'import-statement' }], 'src/main.ts'),
        'shared.js': chunk(['src/app/booking/feature/admin/day-list-page.ts']),
      },
    })
    assert.equal(problems.length, 1)
  })
})

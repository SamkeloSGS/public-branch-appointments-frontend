// @ts-check
// Lint rules, including the architecture rules of the frontend spec (section 3). Boundary violations are errors and
// `npm run build` runs lint first, so a change that breaks them does not build (FE-1).
const eslint = require('@eslint/js')
const { defineConfig } = require('eslint/config')
const tseslint = require('typescript-eslint')
const angular = require('angular-eslint')
const boundariesModule = require('eslint-plugin-boundaries')
const boundaries = boundariesModule.default ?? boundariesModule

// Element types. Order matters: the first pattern that matches a file decides its type.
const elements = [
  { type: 'shared-ui', pattern: 'src/app/shared/ui' },
  { type: 'shared-util', pattern: 'src/app/shared/util' },
  { type: 'shell', pattern: 'src/app/shell' },
  { type: 'app', pattern: ['src/app/*.ts', 'src/main.ts'], mode: 'full' },
  { type: 'environment', pattern: 'src/environments' },
  { type: 'index', pattern: 'src/app/*/index.ts', mode: 'full', capture: ['domain'] },
  { type: 'routes', pattern: 'src/app/*/*.routes.ts', mode: 'full', capture: ['domain'] },
  { type: 'feature', pattern: 'src/app/*/feature', capture: ['domain'] },
  { type: 'ui', pattern: 'src/app/*/ui', capture: ['domain'] },
  { type: 'data', pattern: 'src/app/*/data', capture: ['domain'] },
  { type: 'model', pattern: 'src/app/*/model', capture: ['domain'] },
]

const FROM_DOMAIN = '{{ from.element.captured.domain }}'
const element = (type, domain) => (domain ? { type, captured: { domain } } : { type })
const sameDomain = (type) => element(type, FROM_DOMAIN)
const otherDomainIndex = element('index', `!${FROM_DOMAIN}`)
const identityIndex = element('index', 'identity')
const policy = (fromType, allowed) => ({ from: { element: { type: fromType } }, allow: { to: { element: allowed } } })

const policies = [
  // shared imports from no domain (spec 3.3); shared/ui may use shared/util, never the reverse
  policy('shared-ui', [element('shared-ui'), element('shared-util')]),
  policy('shared-util', [element('shared-util')]),
  // The app wiring and the area shells see each domain only through its entry file
  policy('app', [element('app'), element('shell'), element('index'), element('shared-ui'), element('shared-util'), element('environment')]),
  policy('shell', [element('shell'), element('index'), element('shared-ui'), element('shared-util')]),
  // A domain's entry file exposes routes, data access, ui and types; never feature pages (they are lazy)
  policy('index', [sameDomain('routes'), sameDomain('data'), sameDomain('ui'), sameDomain('model')]),
  policy('routes', [sameDomain('feature'), sameDomain('data'), sameDomain('model'), otherDomainIndex]),
  // Layers inside a domain (spec 3.2); other domains only through their entry file
  policy('feature', [
    sameDomain('feature'),
    sameDomain('ui'),
    sameDomain('data'),
    sameDomain('model'),
    element('shared-ui'),
    element('shared-util'),
    otherDomainIndex,
  ]),
  policy('ui', [sameDomain('ui'), sameDomain('model'), element('shared-ui')]),
  policy('data', [sameDomain('data'), sameDomain('model'), element('shared-util'), identityIndex]),
  policy('model', [sameDomain('model')]),
  // identity imports from no other domain (spec 3.3); policies later in the list win
  {
    from: { element: { type: ['feature', 'data', 'routes'], captured: { domain: 'identity' } } },
    disallow: { to: { element: element('index', '!identity') } },
  },
]

// The admin area is loaded lazily from routes only, so customer code never imports it (FE-18)
const adminOnlyLazy = {
  regex: '(^|/)admin/',
  message: 'Admin code is loaded lazily from routes only.',
}
// ui layers are presentational: no HTTP, stores or router (spec 3.2)
const presentational = ['@angular/common/http', '@angular/router']

module.exports = defineConfig([
  { ignores: ['dist/**', '.angular/**', 'src/app/*/model/api.generated.ts'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      // Outputs are named after what happened, e.g. (select), (save), (retry)
      '@angular-eslint/no-output-native': 'off',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export'],
      'boundaries/include': ['src/**/*'],
      'import/resolver': { typescript: { project: './tsconfig.app.json' } },
    },
    rules: {
      'boundaries/dependencies': ['error', { default: 'disallow', policies }],
      'boundaries/no-unknown-files': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/app/shell/admin/**', 'src/app/*/feature/admin/**', 'src/**/*.spec.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [adminOnlyLazy] }] },
  },
  {
    files: ['src/app/shared/ui/**/*.ts', 'src/app/*/ui/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: presentational, patterns: [adminOnlyLazy] }] },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
])

// Downloads the backend's OpenAPI descriptions into openapi/. Run with the backend up (port 8081), then commit the
// files and run `npm run api:generate`.
import { writeFile } from 'node:fs/promises'

const base = process.env.API_DOCS_URL ?? 'http://localhost:8081/v3/api-docs'

for (const group of ['public', 'admin']) {
  const response = await fetch(`${base}/${group}`)
  if (!response.ok) throw new Error(`GET ${base}/${group} answered ${response.status}`)
  const document = await response.json()
  delete document.servers // the address of the machine that served it, not part of the contract
  await writeFile(new URL(`../openapi/${group}.json`, import.meta.url), JSON.stringify(document, null, 2) + '\n')
  console.log(`openapi/${group}.json: ${Object.keys(document.paths).length} paths`)
}

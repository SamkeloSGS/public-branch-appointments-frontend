// Removes the authenticator (OTP credential) of the local staff test users in the LOCAL Keycloak only, so the next
// end-to-end run sets one up and records its secret in e2e/.auth/. Your own authenticator app entry for these test
// users stops working afterwards. Uses the local Keycloak admin account (admin / admin, see the backend compose.yaml).
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const KEYCLOAK = process.env.KEYCLOAK_URL ?? 'http://localhost:8180'
const USERS = (process.env.E2E_STAFF_USERS ?? 'manager@appointments.test').split(',')

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(KEYCLOAK)) {
  console.error(`Refusing to change ${KEYCLOAK}: only a local Keycloak may be reset`)
  process.exit(1)
}

const tokenResponse = await fetch(`${KEYCLOAK}/realms/master/protocol/openid-connect/token`, {
  method: 'POST',
  body: new URLSearchParams({
    client_id: 'admin-cli',
    username: process.env.KEYCLOAK_ADMIN ?? 'admin',
    password: process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin',
    grant_type: 'password',
  }),
})
if (!tokenResponse.ok) throw new Error(`Keycloak admin sign-in failed: ${tokenResponse.status}`)
const { access_token: token } = await tokenResponse.json()
const admin = (path, init = {}) =>
  fetch(`${KEYCLOAK}/admin/realms/appointments${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })

for (const email of USERS) {
  const [user] = await (await admin(`/users?email=${encodeURIComponent(email)}&exact=true`)).json()
  if (!user) {
    console.warn(`${email}: no such user`)
    continue
  }
  const credentials = await (await admin(`/users/${user.id}/credentials`)).json()
  for (const credential of credentials.filter((candidate) => candidate.type === 'otp')) {
    await admin(`/users/${user.id}/credentials/${credential.id}`, { method: 'DELETE' })
  }
  console.log(`${email}: authenticator removed; the next sign-in sets up a new one`)
}
rmSync(fileURLToPath(new URL('../e2e/.auth/totp-secrets.json', import.meta.url)), { force: true })

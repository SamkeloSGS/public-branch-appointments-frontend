// Settings that differ per environment. The API is always served from the app's own origin under /api (the dev
// server proxies it; CloudFront does in production), so only the Keycloak address changes.
export const environment = {
  keycloak: {
    url: 'http://localhost:8180',
    realm: 'appointments',
    clientId: 'appointments-web',
  },
  // The backend's booking.cancel-cutoff, used only to explain in advance why an appointment can no longer be changed
  // online. The server still decides; a PAST_CUTOFF answer is shown the same way.
  changeCutoffMinutes: 60,
  // The backend's booking.no-show-grace: staff can record a no-show this long after the start
  noShowGraceMinutes: 15,
}

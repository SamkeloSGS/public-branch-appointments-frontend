import { expect } from '@playwright/test'

// The emails Keycloak and the backend send in the local stack, read from Mailpit's API (the backend's compose.yaml,
// web UI on http://localhost:8025).

const MAILPIT = process.env['E2E_MAILPIT_URL'] ?? 'http://localhost:8025'

export interface Email {
  subject: string
  text: string
}

interface Summary {
  ID: string
  Subject: string
}

/** Waits for the newest email to `to` whose subject matches, and returns it. */
export async function waitForEmail(to: string, subject: RegExp, timeout = 30_000): Promise<Email> {
  let found: Summary | undefined
  await expect
    .poll(
      async () => {
        const response = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)
        const { messages } = (await response.json()) as { messages: Summary[] }
        found = messages.find((message) => subject.test(message.Subject))
        return found?.Subject
      },
      { message: `an email to ${to} with a subject matching ${subject}`, timeout, intervals: [1_000] },
    )
    .toBeTruthy()
  const message = (await (await fetch(`${MAILPIT}/api/v1/message/${found!.ID}`)).json()) as { Text: string }
  return { subject: found!.Subject, text: message.Text }
}

/** The first link in the email that starts with `prefix`. */
export function linkIn(email: Email, prefix: string): string {
  const link = email.text.match(/https?:\/\/\S+/g)?.find((candidate) => candidate.startsWith(prefix))
  expect(link, `a link starting with ${prefix} in "${email.subject}"`).toBeTruthy()
  return link!
}

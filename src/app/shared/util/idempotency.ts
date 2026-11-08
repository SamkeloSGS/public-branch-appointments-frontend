/** A new key for one logical request; every retry of that request sends the same key. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

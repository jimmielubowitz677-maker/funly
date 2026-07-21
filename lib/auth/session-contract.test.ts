import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Node's native TypeScript test runner requires the source extension.
import { validateSessionResult } from './session-contract.ts'

test('rejects a user response with a null session', () => {
  assert.deepEqual(validateSessionResult(null), { ok: false, reason: 'session_missing' })
})

test('rejects a session without an access token', () => {
  assert.deepEqual(validateSessionResult({ refresh_token: 'hidden' }), {
    ok: false,
    reason: 'access_token_missing',
  })
})

test('rejects a session without a refresh token', () => {
  assert.deepEqual(validateSessionResult({ access_token: 'hidden' }), {
    ok: false,
    reason: 'refresh_token_missing',
  })
})

test('rejects a Supabase Auth error before inspecting session data', () => {
  assert.deepEqual(validateSessionResult(null, new Error('auth failed')), {
    ok: false,
    reason: 'auth_error',
  })
})

test('accepts only a complete session and returns both tokens', () => {
  const result = validateSessionResult({
    access_token: 'access-hidden',
    refresh_token: 'refresh-hidden',
    user: { id: 'user-id' },
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(Boolean(result.accessToken), true)
    assert.equal(Boolean(result.refreshToken), true)
    assert.equal(result.userId, 'user-id')
  }
})

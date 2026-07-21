export type SessionFailureReason =
  | 'auth_error'
  | 'session_missing'
  | 'access_token_missing'
  | 'refresh_token_missing'

type SessionLike = {
  access_token?: string | null
  refresh_token?: string | null
  user?: { id?: string | null } | null
} | null

export type SessionResult =
  | {
      ok: true
      accessToken: string
      refreshToken: string
      userId: string | null
    }
  | { ok: false; reason: SessionFailureReason }

export function validateSessionResult(
  session: SessionLike,
  authError: unknown = null
): SessionResult {
  if (authError) return { ok: false, reason: 'auth_error' }
  if (!session) return { ok: false, reason: 'session_missing' }
  if (!session.access_token) return { ok: false, reason: 'access_token_missing' }
  if (!session.refresh_token) return { ok: false, reason: 'refresh_token_missing' }

  return {
    ok: true,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    userId: session.user?.id ?? null,
  }
}

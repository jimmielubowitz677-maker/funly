'use client'

import { useState } from 'react'
import { Camera, Upload, CheckCircle, AlertCircle, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface InitialProfile {
  username: string
  displayName: string
  bio: string
  avatarUrl: string | null
  bannerUrl: string | null
}

interface ProfileFormProps {
  userId: string
  initialProfile: InitialProfile
}

export default function ProfileForm({ userId, initialProfile }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialProfile.displayName)
  const [username, setUsername]       = useState(initialProfile.username)
  const [bio, setBio]                 = useState(initialProfile.bio)

  // These track the currently-saved URLs (updated after every successful save).
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string | null>(initialProfile.avatarUrl)
  const [savedBannerUrl, setSavedBannerUrl] = useState<string | null>(initialProfile.bannerUrl)

  // Local previews — blob: while a new file is staged, saved URL otherwise.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialProfile.avatarUrl)
  const [bannerPreview, setBannerPreview] = useState<string | null>(initialProfile.bannerUrl)

  // The actual File objects to upload; null = no change.
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)

  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  function pickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (bannerPreview?.startsWith('blob:')) URL.revokeObjectURL(bannerPreview)
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  function removeAvatar() {
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(null)
    setAvatarPreview(null)
    setSavedAvatarUrl(null)
  }

  function removeBanner() {
    if (bannerPreview?.startsWith('blob:')) URL.revokeObjectURL(bannerPreview)
    setBannerFile(null)
    setBannerPreview(null)
    setSavedBannerUrl(null)
  }

  function validateUsername(val: string): boolean {
    if (!val) { setUsernameError('Username is required'); return false }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(val)) {
      setUsernameError('3–30 characters: letters, numbers, underscores only')
      return false
    }
    setUsernameError(null)
    return true
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!validateUsername(username)) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    // Build FormData — files are sent as binary; server handles storage upload.
    const fd = new FormData()
    fd.append('display_name',      displayName)
    fd.append('username',          username)
    fd.append('bio',               bio)
    // Tell the server what the current saved URLs are so it can preserve them
    // when no new file was selected.
    fd.append('current_avatar_url', savedAvatarUrl ?? '')
    fd.append('current_banner_url', savedBannerUrl ?? '')
    if (avatarFile) fd.append('avatar', avatarFile)
    if (bannerFile) fd.append('banner', bannerFile)

    let res: Response
    try {
      // POST to the API route — no Content-Type header so the browser sets the
      // multipart boundary automatically.
      res = await fetch('/api/admin/profile', { method: 'POST', body: fd })
    } catch {
      setError('Network error — check your connection and try again.')
      setSaving(false)
      return
    }

    const data = await res.json().catch(() => ({})) as {
      success?: boolean
      avatar_url?: string | null
      banner_url?: string | null
      error?: string
    }

    if (!res.ok) {
      if (res.status === 409 || res.status === 422) {
        setUsernameError(data.error ?? 'Invalid username.')
      } else {
        setError(data.error ?? 'Save failed — please try again.')
      }
      setSaving(false)
      return
    }

    // Commit the URLs the server actually stored.
    const finalAvatar = data.avatar_url ?? null
    const finalBanner = data.banner_url ?? null

    setSavedAvatarUrl(finalAvatar)
    setSavedBannerUrl(finalBanner)

    if (avatarFile) {
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(finalAvatar)
      setAvatarFile(null)
    }
    if (bannerFile) {
      if (bannerPreview?.startsWith('blob:')) URL.revokeObjectURL(bannerPreview)
      setBannerPreview(finalBanner)
      setBannerFile(null)
    }

    setSuccess(true)
    setSaving(false)
    setTimeout(() => setSuccess(false), 4000)
  }

  const initials = (displayName || username || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <form onSubmit={handleSave} className="space-y-5">

      {/* ── Banner ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="relative h-36 bg-gradient-to-r from-pink-500/25 via-rose-500/15 to-purple-600/25">
          {bannerPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerPreview} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
          )}

          {/* Clicking this label natively opens the file picker — no JS .click() needed */}
          <label
            htmlFor={`${userId}-banner`}
            className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/0 hover:bg-black/40 transition-colors group"
          >
            <span className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 text-zinc-200 text-sm font-medium px-4 py-2 rounded-xl shadow opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="w-4 h-4" />
              {bannerPreview ? 'Change banner' : 'Upload banner'}
            </span>
          </label>

          {bannerPreview && (
            <button
              type="button"
              onClick={removeBanner}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-zinc-900/80 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors z-10"
              aria-label="Remove banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <input
          id={`${userId}-banner`}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={pickBanner}
        />

        {/* ── Avatar ── */}
        <div className="px-5 pb-5">
          <div className="flex items-end gap-4 -mt-8 mb-4">

            {/* Avatar — label wraps the whole thumbnail so clicking it opens the picker */}
            <div className="relative flex-shrink-0">
              <label
                htmlFor={`${userId}-avatar`}
                className="block w-16 h-16 rounded-2xl border-4 border-zinc-900 shadow-xl overflow-hidden bg-gradient-to-br from-pink-500 to-rose-600 cursor-pointer group relative"
              >
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-xl font-bold text-white">
                    {initials}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100">
                  <Camera className="w-5 h-5 text-white" />
                </span>
              </label>

              {avatarPreview && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-colors z-10"
                  aria-label="Remove avatar"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <input
              id={`${userId}-avatar`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={pickAvatar}
            />

            <div className="mb-1 min-w-0">
              <p className="font-semibold text-sm text-zinc-200 truncate">
                {displayName || username || 'Your Name'}
              </p>
              <p className="text-xs text-zinc-500">@{username || 'username'}</p>
              <p className="text-xs text-zinc-600 mt-1">JPG, PNG, WebP, GIF · max 50 MB</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile fields ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Profile Info</h2>

        <Input
          id="display-name"
          label="Display Name"
          placeholder="Sofia Rose"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          maxLength={60}
        />

        <Input
          id="username"
          label="Username"
          placeholder="sofiarose"
          value={username}
          onChange={e => { setUsername(e.target.value); setUsernameError(null) }}
          onBlur={() => validateUsername(username)}
          error={usernameError ?? undefined}
          maxLength={30}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bio" className="text-sm font-medium text-zinc-300">Bio</label>
          <textarea
            id="bio"
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell your subscribers about yourself…"
            rows={3}
            maxLength={300}
            className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-colors resize-none"
          />
          <p className="text-xs text-zinc-600 text-right">{bio.length}/300</p>
        </div>
      </div>

      {/* ── Feedback ── */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Profile saved successfully.
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" loading={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

    </form>
  )
}

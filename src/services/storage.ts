import type { SkinProfile } from '../features/onboarding/types'

const PROFILE_STORAGE_KEY = 'candid.profile.v1'

export function saveSkinProfile(profile: SkinProfile): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

export function loadSkinProfile(): SkinProfile | null {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as SkinProfile
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY)
    return null
  }
}

export function clearSkinProfile(): void {
  localStorage.removeItem(PROFILE_STORAGE_KEY)
}

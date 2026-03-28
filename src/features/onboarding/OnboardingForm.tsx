import { useMemo, useState } from 'react'
import {
  CONCERNS,
  SENSITIVITY_LEVELS,
  SKIN_TONES,
  SKIN_TYPES,
  type Concern,
  type SkinProfile,
} from './types'
import { validateSkinProfile } from './validation'

interface OnboardingFormProps {
  initialProfile?: SkinProfile | null
  onComplete: (profile: SkinProfile) => void
}

const concernLabels: Record<Concern, string> = {
  acne: 'Acne',
  dryness: 'Dryness',
  aging: 'Aging',
  dark_spots: 'Dark spots',
  redness: 'Redness',
  sensitivity: 'Sensitivity',
  dullness: 'Dullness',
}

const toneSwatches: Record<(typeof SKIN_TONES)[number], string> = {
  fair: '#f7e6d5',
  light: '#efcead',
  medium: '#cf9d74',
  tan: '#a97752',
  deep: '#6b462b',
  rich: '#402614',
}

export function OnboardingForm({ initialProfile, onComplete }: OnboardingFormProps) {
  const [skinType, setSkinType] = useState<SkinProfile['skinType']>(initialProfile?.skinType ?? 'not_sure')
  const [skinTone, setSkinTone] = useState<SkinProfile['skinTone']>(initialProfile?.skinTone ?? 'medium')
  const [topConcern, setTopConcern] = useState<SkinProfile['topConcern']>(
    initialProfile?.topConcern ?? 'acne',
  )
  const [secondaryConcerns, setSecondaryConcerns] = useState<Concern[]>(
    initialProfile?.secondaryConcerns ?? [],
  )
  const [sensitivity, setSensitivity] = useState<SkinProfile['sensitivity']>(
    initialProfile?.sensitivity ?? 'sometimes_reactive',
  )
  const [error, setError] = useState<string | null>(null)

  const availableSecondaryConcerns = useMemo(
    () => CONCERNS.filter((concern) => concern !== topConcern),
    [topConcern],
  )

  function toggleSecondaryConcern(concern: Concern) {
    setSecondaryConcerns((current) => {
      if (current.includes(concern)) {
        return current.filter((value) => value !== concern)
      }
      if (current.length >= 2) {
        return current
      }
      return [...current, concern]
    })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const profile: SkinProfile = {
      skinType,
      skinTone,
      topConcern,
      secondaryConcerns,
      sensitivity,
    }

    const result = validateSkinProfile(profile)
    if (!result.valid) {
      setError(result.message ?? 'Please check your answers.')
      return
    }

    setError(null)
    onComplete(profile)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-zinc-900">1) Skin type</label>
        <select
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
          value={skinType}
          onChange={(event) => setSkinType(event.target.value as SkinProfile['skinType'])}
        >
          {SKIN_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace('_', ' ').replace(/^\w/, (char) => char.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-zinc-900">2) Skin tone</p>
        <div className="grid grid-cols-3 gap-2">
          {SKIN_TONES.map((tone) => (
            <button
              type="button"
              key={tone}
              onClick={() => setSkinTone(tone)}
              className={`rounded-xl border px-2 py-3 text-xs font-medium capitalize ${
                skinTone === tone ? 'border-plum-700 ring-2 ring-plum-200' : 'border-zinc-300'
              }`}
            >
              <span
                className="mx-auto mb-1 block h-6 w-6 rounded-full border border-zinc-300"
                style={{ backgroundColor: toneSwatches[tone] }}
              />
              {tone}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-zinc-900">3) Top concern</label>
        <select
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
          value={topConcern}
          onChange={(event) => {
            const concern = event.target.value as Concern
            setTopConcern(concern)
            setSecondaryConcerns((current) => current.filter((value) => value !== concern))
          }}
        >
          {CONCERNS.map((concern) => (
            <option key={concern} value={concern}>
              {concernLabels[concern]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-zinc-900">4) Secondary concerns (up to 2)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {availableSecondaryConcerns.map((concern) => (
            <label
              key={concern}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={secondaryConcerns.includes(concern)}
                onChange={() => toggleSecondaryConcern(concern)}
              />
              {concernLabels[concern]}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-zinc-900">5) Sensitivity</label>
        <select
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
          value={sensitivity}
          onChange={(event) => setSensitivity(event.target.value as SkinProfile['sensitivity'])}
        >
          {SENSITIVITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level.replace('_', ' ').replace(/^\w/, (char) => char.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-xl bg-plum-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-plum-500"
      >
        Save skin profile
      </button>
    </form>
  )
}

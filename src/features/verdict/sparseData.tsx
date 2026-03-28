import { MINIMUM_SOURCES } from '../../services/synthesisEngine'

interface SparseDataProps {
  sourceCount: number
}

export function SparseDataState({ sourceCount }: SparseDataProps) {
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="text-base font-semibold">Not enough data yet</p>
      <p className="mt-2">
        We found {sourceCount} sources. SkinSense needs at least {MINIMUM_SOURCES} detailed reviews
        before showing a verdict.
      </p>
      <p className="mt-2">Try again in a few weeks or test another product with more discussion.</p>
    </section>
  )
}

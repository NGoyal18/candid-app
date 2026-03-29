import { MINIMUM_SOURCES } from '../../services/synthesisEngine'

interface SparseDataProps {
  sourceCount: number
}

export function SparseDataState({ sourceCount }: SparseDataProps) {
  return (
    <section className="border-[1.5px] border-[#d4c4b0] bg-[#fff8f0] p-4 text-[12px] leading-[1.7] text-[#5a4a38]">
      <p className="text-[10px] uppercase tracking-[0.25em] text-[#6b1f2e]">not enough data yet</p>
      <p className="mt-2">
        We found {sourceCount} sources. Candid needs at least {MINIMUM_SOURCES} detailed reviews
        before showing a verdict.
      </p>
      <p className="mt-2 text-[#9a8a72]">
        Try again in a few weeks or test another product with more discussion.
      </p>
    </section>
  )
}

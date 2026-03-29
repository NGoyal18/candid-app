import type { Verdict } from '../../services/synthesisEngine'
import { useState } from 'react'
import type { ParsedProduct } from '../../services/productParser'

interface VerdictCardProps {
  verdict: Verdict
  product: ParsedProduct | null
}

function verdictPill(recommendation: string | undefined, score: number | undefined): {
  label: string
  classes: string
} {
  const shouldNotTry =
    typeof recommendation === 'string' &&
    recommendation.toLowerCase().includes('should not try')

  if (shouldNotTry) {
    return { label: 'skip it', classes: 'border-[1.5px] border-[#b09a80] text-[#9a8a72]' }
  }

  // "should try" path — use score for holy grail vs worth it distinction.
  if (typeof score === 'number' && score >= 85) {
    return { label: 'holy grail', classes: 'bg-[#2e5c3a] text-[#f5ede0]' }
  }
  return { label: 'worth it', classes: 'bg-[#6b1f2e] text-[#fff8f0]' }
}

export function VerdictCard({ verdict, product }: VerdictCardProps) {
  const [showSources, setShowSources] = useState(false)

  if (verdict.status !== 'ready') {
    return null
  }

  return (
    <section className="space-y-4 border-[1.5px] border-[#d4c4b0] bg-[#fff8f0] p-5">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#b09a80]">
              {product?.brand ?? 'brand'}
            </p>
            <p className="candid-display text-[18px] leading-[1.2] text-[#1c1208]">
              {product?.name ?? 'product'}
            </p>
          </div>
          <span
            className={`px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${verdictPill(verdict.recommendation, verdict.matchScore).classes}`}
          >
            {verdictPill(verdict.recommendation, verdict.matchScore).label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-[#d4c4b0] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#9a8a72]">
            match score: {verdict.matchScore}/100
          </span>
          <span className="border border-[#d4c4b0] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#9a8a72]">
            confidence: {verdict.confidence}
          </span>
        </div>

        {verdict.recommendation ? (
          <p className="text-[12px] leading-[1.7] text-[#5a4a38]">
            {verdict.recommendation}
            {verdict.bottomLine ? ` ${verdict.bottomLine}` : null}
          </p>
        ) : null}

        {verdict.reasoningSummary ? (
          <div className="border-l-[3px] border-l-[#6b1f2e] pl-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#6b1f2e]">
              Why this verdict
            </p>
            <div className="space-y-2 text-[12px] leading-[1.7] text-[#5a4a38]">
              {verdict.reasoningSummary.split('\n\n').filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <div className="border-t border-[#d4c4b0]" />

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setShowSources((value) => !value)}
          className="text-[10px] uppercase tracking-[0.2em] text-[#6b1f2e]"
        >
          {showSources ? 'Hide top 3 sources' : 'Show top 3 sources'}
        </button>
        {showSources ? (
          <ul className="flex flex-wrap gap-2">
            {(verdict.topSources ?? []).slice(0, 3).map((item) => (
              <li key={`top-${item.sourceUrl}`}>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block border border-[#d4c4b0] px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-[#b09a80]"
                >
                  {item.sourceName}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  )
}

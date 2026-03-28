import type { Verdict } from '../../services/synthesisEngine'
import { useState } from 'react'

interface VerdictCardProps {
  verdict: Verdict
}

function confidenceClasses(confidence: 'low' | 'medium' | 'high'): string {
  if (confidence === 'high') {
    return 'bg-emerald-100 text-emerald-800'
  }
  if (confidence === 'medium') {
    return 'bg-amber-100 text-amber-900'
  }
  return 'bg-zinc-200 text-zinc-700'
}

export function VerdictCard({ verdict }: VerdictCardProps) {
  const [showSources, setShowSources] = useState(false)

  if (verdict.status !== 'ready') {
    return null
  }

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-plum-100 px-3 py-1 text-sm font-semibold text-plum-700">
            Match score: {verdict.matchScore}/100
          </span>
          {verdict.confidence ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${confidenceClasses(verdict.confidence)}`}
            >
              {verdict.confidence} confidence
            </span>
          ) : null}
        </div>
        {verdict.recommendation ? (
          <p className="rounded-xl bg-plum-50 p-3 text-sm font-semibold text-plum-900">
            {verdict.recommendation}
          </p>
        ) : null}
        {verdict.reasoningSummary ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Why this verdict
            </p>
            <div className="space-y-3 text-sm leading-6 text-zinc-700">
              {verdict.reasoningSummary.split('\n\n').filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <footer className="rounded-xl bg-zinc-100 p-3 text-sm font-medium text-zinc-900">
        Bottom line: {verdict.bottomLine}
      </footer>

      <section className="space-y-2 rounded-xl border border-zinc-200 p-3">
        <button
          type="button"
          onClick={() => setShowSources((value) => !value)}
          className="text-sm font-semibold text-plum-700 hover:text-plum-500"
        >
          {showSources ? 'Hide top 3 sources' : 'Show top 3 sources'}
        </button>
        {showSources ? (
          <ul className="space-y-1 text-sm">
            {(verdict.topSources ?? []).slice(0, 3).map((item) => (
              <li key={`top-${item.sourceUrl}`} className="text-zinc-700">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-plum-700 hover:text-plum-500"
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

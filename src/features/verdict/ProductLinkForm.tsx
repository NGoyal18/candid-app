import { useState } from 'react'
import type { SkinProfile } from '../onboarding/types'
import { searchReviews } from '../../services/mockReviewSearch'
import { parseProductFromUrl, type ParsedProduct } from '../../services/productParser'
import { filterReviewsForProfile, synthesizeVerdict, type Verdict, MINIMUM_SOURCES } from '../../services/synthesisEngine'
import { enhanceVerdictWithLlm } from '../../services/llmSynthesis'
import { extractProductIngredients } from '../../services/productIngredients'
import { SparseDataState } from './sparseData'
import { VerdictCard } from './VerdictCard'

interface ProductLinkFormProps {
  profile: SkinProfile
}

export function ProductLinkForm({ profile }: ProductLinkFormProps) {
  const [urlInput, setUrlInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [product, setProduct] = useState<ParsedProduct | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)

  async function handleAnalyze(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setVerdict(null)
    setProduct(null)

    setIsLoading(true)
    try {
      let parsedProduct: ParsedProduct
      try {
        parsedProduct = await parseProductFromUrl(urlInput.trim())
        setProduct(parsedProduct)
      } catch (parsingError) {
        setError(parsingError instanceof Error ? parsingError.message : 'Invalid URL')
        return
      }

      const [reviews, productIngredients] = await Promise.all([
        searchReviews(parsedProduct),
        extractProductIngredients(parsedProduct.originalUrl),
      ])
      const matchedReviews = filterReviewsForProfile(profile, reviews)
      const reviewsForSynthesis = matchedReviews.length >= MINIMUM_SOURCES ? matchedReviews : reviews
      const baseVerdict = synthesizeVerdict(parsedProduct, profile, reviewsForSynthesis)
      const nextVerdict = await enhanceVerdictWithLlm(
        baseVerdict,
        parsedProduct,
        profile,
        reviewsForSynthesis,
        productIngredients,
      )
      setVerdict(nextVerdict)
    } catch (analysisError) {
      if (analysisError instanceof Error) {
        setError(analysisError.message)
      } else {
        setError('Could not analyze this link right now. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <form className="space-y-2" onSubmit={handleAnalyze}>
        <div className="relative">
          <input
            type="url"
            required
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            className="w-full border-[1.5px] border-[#1c1208] bg-[#fff8f0] px-4 py-[14px] pr-20 text-[12px] text-[#1c1208] outline-none placeholder:text-[#9a8a72]"
            placeholder="paste a product link..."
          />
          <button
            type="submit"
            disabled={isLoading}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#c45c2e] disabled:opacity-50"
          >
            {isLoading ? 'wait' : 'go →'}
          </button>
        </div>
        <p className="text-[10px] text-[#b09a80]">
          we search reddit, influenster, beauty blogs + more
        </p>
      </form>

      {product ? (
        <p className="border border-[#d4c4b0] bg-[#fff8f0] p-3 text-[10px] uppercase tracking-[0.18em] text-[#9a8a72]">
          Looking at <span className="text-[#1c1208]">{product.brand}</span> - {product.name}
        </p>
      ) : null}

      {error ? (
        <p className="border border-[#d4c4b0] bg-[#fff8f0] p-3 text-[11px] text-[#c45c2e]">{error}</p>
      ) : null}

      {(verdict?.status === 'ready' || verdict?.status === 'insufficient' || isLoading) ? (
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#c45c2e]">↓ verdict for your skin</p>
      ) : null}

      {isLoading ? (
        <>
          <section className="border-[1.5px] border-[#d4c4b0] bg-[#fff8f0] p-5">
            <div className="h-3 w-20 bg-[#d4c4b0]" />
            <div className="mt-3 h-6 w-2/3 bg-[#d4c4b0]" />
            <div className="mt-4 h-16 w-full bg-[#d4c4b0]" />
          </section>
          <section className="border-[1.5px] border-[#d4c4b0] bg-[#fff8f0] p-5 opacity-45">
            <div className="h-3 w-20 bg-[#d4c4b0]" />
            <div className="mt-3 h-6 w-2/3 bg-[#d4c4b0]" />
            <div className="mt-4 h-16 w-full bg-[#d4c4b0]" />
          </section>
        </>
      ) : null}

      {verdict?.status === 'insufficient' ? (
        <SparseDataState sourceCount={verdict.totalSources} />
      ) : null}

      {verdict?.status === 'ready' ? <VerdictCard verdict={verdict} product={product} /> : null}
    </section>
  )
}

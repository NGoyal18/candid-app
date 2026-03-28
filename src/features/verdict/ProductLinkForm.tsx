import { useState } from 'react'
import type { SkinProfile } from '../onboarding/types'
import { searchReviews } from '../../services/mockReviewSearch'
import { parseProductFromUrl, type ParsedProduct } from '../../services/productParser'
import { synthesizeVerdict, type Verdict } from '../../services/synthesisEngine'
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

    let parsedProduct: ParsedProduct
    try {
      parsedProduct = parseProductFromUrl(urlInput.trim())
      setProduct(parsedProduct)
    } catch (parsingError) {
      setError(parsingError instanceof Error ? parsingError.message : 'Invalid URL')
      return
    }

    try {
      setIsLoading(true)
      const [reviews, productIngredients] = await Promise.all([
        searchReviews(parsedProduct),
        extractProductIngredients(parsedProduct.originalUrl),
      ])
      const baseVerdict = synthesizeVerdict(parsedProduct, profile, reviews)
      const nextVerdict = await enhanceVerdictWithLlm(
        baseVerdict,
        parsedProduct,
        profile,
        reviews,
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
      <form className="space-y-3" onSubmit={handleAnalyze}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">Paste a product link</span>
          <input
            type="url"
            required
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-plum-500 focus:ring-2"
            placeholder="https://www.sephora.com/product/..."
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-plum-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-plum-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Searching web + community reviews...' : 'Get my verdict'}
        </button>
      </form>

      {product ? (
        <p className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700">
          Looking at <span className="font-semibold text-zinc-900">{product.brand}</span> - {product.name}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {verdict?.status === 'insufficient' ? (
        <SparseDataState sourceCount={verdict.totalSources} />
      ) : null}

      {verdict?.status === 'ready' ? <VerdictCard verdict={verdict} /> : null}
    </section>
  )
}

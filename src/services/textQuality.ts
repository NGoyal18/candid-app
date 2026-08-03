// Heuristic sanity check on LLM-generated verdict text before it's shown to the user.
// This isn't full grammar checking (no NLP library involved) — it catches the failure
// modes free/weak models actually produce: doubled words, missing end punctuation,
// unbalanced quotes, and leftover template/placeholder artifacts.

const DOUBLED_WORD = /\b(\w+)\s+\1\b/i

const PLACEHOLDER_LEAK = /\bundefined\b|\bnull\b|\[object Object\]|\{\{.*?\}\}|\bNaN\b/i

function hasUnbalancedQuotesOrParens(text: string): boolean {
  const doubleQuotes = (text.match(/"/g) ?? []).length
  if (doubleQuotes % 2 !== 0) return true

  let depth = 0
  for (const char of text) {
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    if (depth < 0) return true
  }
  return depth !== 0
}

function endsWithTerminalPunctuation(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  return /[.!?"')]$/.test(trimmed)
}

export function hasQualityIssues(text: string | undefined): boolean {
  if (!text || !text.trim()) return true
  if (DOUBLED_WORD.test(text)) return true
  if (PLACEHOLDER_LEAK.test(text)) return true
  if (hasUnbalancedQuotesOrParens(text)) return true
  if (!endsWithTerminalPunctuation(text)) return true
  return false
}

// Scraped review text and LLM output both pass through here before reaching the user.
// Review snippets come from arbitrary, untrusted web pages — a page author could plant
// text aimed at hijacking the downstream LLM synthesis call (prompt injection), and either
// source could surface content that shouldn't be shown as-is.

const INJECTION_PATTERNS =
  /ignore (all |any )?(the )?(previous|above|prior) instructions|disregard (all |any )?(previous|prior) (instructions|context)|you are now (a|an)\b|new instructions\s*:|system prompt|forget (everything|all previous)|act as (if|though) you|\bjailbreak\b|\bDAN\b mode/i

const UNSAFE_CONTENT_PATTERNS =
  /\b(kill (yourself|urself)|kys)\b|how to (make|build|synthesize) a (bomb|weapon|explosive)|child (sexual|porn)/i

const MARKUP_PATTERNS = /<\s*(script|iframe|object|embed)\b|javascript\s*:/i

export function isUnsafeText(text: string): boolean {
  if (!text) return false
  return INJECTION_PATTERNS.test(text) || UNSAFE_CONTENT_PATTERNS.test(text) || MARKUP_PATTERNS.test(text)
}

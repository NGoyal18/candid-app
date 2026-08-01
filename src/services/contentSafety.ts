// Last line of defense on the LLM's generated verdict text before it's shown to the user.
// Review snippets are already filtered server-side, but this catches anything the model
// hallucinates or gets talked into on its own (e.g. a successful jailbreak despite the
// hardened prompt).

const INJECTION_LEAK_PATTERNS =
  /ignore (all |any )?(the )?(previous|above|prior) instructions|disregard (all |any )?(previous|prior) (instructions|context)|as an ai\b|i cannot comply|jailbreak|system prompt|you are now (a|an)\b/i

const UNSAFE_CONTENT_PATTERNS =
  /\b(kill (yourself|urself)|kys)\b|how to (make|build|synthesize) a (bomb|weapon|explosive)|child (sexual|porn)/i

const MARKUP_PATTERNS = /<\s*(script|iframe|object|embed)\b|javascript\s*:/i

export function isUnsafeText(text: string): boolean {
  if (!text) return false
  return INJECTION_LEAK_PATTERNS.test(text) || UNSAFE_CONTENT_PATTERNS.test(text) || MARKUP_PATTERNS.test(text)
}

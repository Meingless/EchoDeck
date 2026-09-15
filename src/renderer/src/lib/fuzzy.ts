export type FuzzyResult = { score: number; indices: number[] }

export function fuzzyMatch(text: string, query: string): FuzzyResult | null {
  if (!query) return { score: 0, indices: [] }
  const t = text.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return { score: 0, indices: [] }
  if (t.includes(q)) {
    const idx = t.indexOf(q)
    const bonus = idx === 0 ? 60 : text[idx] === ' ' || /[^a-z0-9]/.test(text[idx - 1] ?? '') ? 40 : 0
    const indices: number[] = []
    for (let i = 0; i < q.length; i++) indices.push(idx + i)
    return { score: 100 + bonus - idx * 0.5 - (t.length - q.length) * 0.1, indices }
  }

  const indices: number[] = []
  let ti = 0
  let score = 0
  let lastHit = -2
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]
    let found = -1
    for (let i = ti; i < t.length; i++) {
      if (t[i] === c) {
        found = i
        break
      }
    }
    if (found === -1) return null
    let s = 10
    if (found === lastHit + 1) s += 12
    if (found === 0 || /[^a-z0-9]/.test(t[found - 1] ?? '')) s += 18
    if (t[found] !== q[qi]) s -= 6
    score += s
    indices.push(found)
    lastHit = found
    ti = found + 1
  }
  score -= (t.length - q.length) * 0.15
  return { score, indices }
}

export function highlight(text: string, indices: number[]): { text: string; hit: boolean }[] {
  if (!indices.length) return [{ text, hit: false }]
  const set = new Set(indices)
  const parts: { text: string; hit: boolean }[] = []
  let current = ''
  let currentHit = false
  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i)
    if (hit !== currentHit && current) {
      parts.push({ text: current, hit: currentHit })
      current = ''
    }
    currentHit = hit
    current += text[i]
  }
  if (current) parts.push({ text: current, hit: currentHit })
  return parts
}

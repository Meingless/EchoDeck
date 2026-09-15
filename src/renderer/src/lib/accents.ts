import type { AccentId } from './types'

type AccentDef = { label: string; h: number; s: number; l: number; onAccent: string }

export const ACCENTS: Record<AccentId, AccentDef> = {
  violet: { label: 'Violet', h: 257, s: 84, l: 68, onAccent: '#0c0d10' },
  blue: { label: 'Electric Blue', h: 212, s: 92, l: 62, onAccent: '#08090b' },
  cyan: { label: 'Cyan', h: 188, s: 78, l: 55, onAccent: '#06100f' },
  green: { label: 'Mint', h: 152, s: 62, l: 54, onAccent: '#06110c' },
  amber: { label: 'Amber', h: 38, s: 92, l: 58, onAccent: '#140d02' },
  pink: { label: 'Rose', h: 337, s: 84, l: 66, onAccent: '#16070c' }
}

export function applyAccent(id: AccentId) {
  const a = ACCENTS[id] ?? ACCENTS.violet
  const root = document.documentElement
  root.style.setProperty('--accent-h', String(a.h))
  root.style.setProperty('--accent-s', `${a.s}%`)
  root.style.setProperty('--accent-l', `${a.l}%`)
  root.style.setProperty('--text-on-accent', a.onAccent)
}

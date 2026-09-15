import { useLayoutEffect, useRef, useState } from 'react'

export function useNavIndicator<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [pos, setPos] = useState({ top: 0, opacity: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const items = el.querySelectorAll<HTMLElement>('.nav-item.active')
    const active = items.length ? items[items.length - 1] : null
    if (!active) {
      setPos((p) => (p.opacity === 0 ? p : { ...p, opacity: 0 }))
      return
    }
    const top = active.offsetTop
    setPos((p) => (p.top === top && p.opacity === 1 ? p : { top, opacity: 1 }))
  })

  return { ref, pos }
}
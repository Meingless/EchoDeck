import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { engine } from '@/lib/audio'
import type { Sound } from '@/lib/types'

export function Waveform({ sound, large }: { sound: Sound; large?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const peaks = useMemo(() => sound.peaks ?? [], [sound.id])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return engine.onProgress((id, progress, active) => {
      if (id !== sound.id) return
      el.style.setProperty('--wave-progress', active ? String(Math.min(1, progress)) : '0')
    })
  }, [sound.id])

  return (
    <div ref={ref} className={`waveform${large ? ' large' : ''}`} style={{ '--wave-progress': 0 } as CSSProperties} aria-hidden>
      <div className="wf-layer wf-base">
        {peaks.map((p, i) => (
          <span key={i} className="bar" style={{ '--peak': p } as CSSProperties} />
        ))}
      </div>
      <div className="wf-layer wf-progress">
        {peaks.map((p, i) => (
          <span key={i} className="bar" style={{ '--peak': p } as CSSProperties} />
        ))}
      </div>
    </div>
  )
}

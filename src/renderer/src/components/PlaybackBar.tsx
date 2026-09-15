import { useEffect, useRef } from 'react'
import { Square, X } from 'lucide-react'
import { useStore } from '@/store/store'
import { usePlayer } from '@/store/player'
import { engine } from '@/lib/audio'

function PlayingChip({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const sound = useStore((s) => s.sounds.find((x) => x.id === id))
  const stop = usePlayer((s) => s.stop)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return engine.onProgress((pid, progress, active) => {
      if (pid !== id) return
      el.style.setProperty('--wave-progress', active ? String(Math.min(1, progress)) : '0')
    })
  }, [id])

  if (!sound) return null

  return (
    <div className="pb-chip" ref={ref} title={sound.name}>
      <span className="pb-dot" />
      <span className="pb-name">{sound.name}</span>
      <span className="pb-progress">
        <i />
      </span>
      <button className="pb-stop" onClick={() => stop(id)} aria-label={`Stop ${sound.name}`}>
        <X size={13} />
      </button>
    </div>
  )
}

export function PlaybackBar() {
  const active = usePlayer((s) => s.active)
  const stopAll = usePlayer((s) => s.stopAll)
  const showPlaybackBar = useStore((s) => s.settings.showPlaybackBar)

  if (!active.length || !showPlaybackBar) return null

  return (
    <div className="playback-bar" role="toolbar" aria-label="Active sounds">
      {active.slice(0, 5).map((id) => (
        <PlayingChip key={id} id={id} />
      ))}
      {active.length > 5 && <span className="pb-name" style={{ color: 'var(--text-tertiary)', padding: '0 4px' }}>+{active.length - 5}</span>}
      <span className="pb-sep" />
      <button className="pb-stopall" onClick={stopAll}>
        <Square size={11.5} strokeWidth={2.6} />
        Stop All
      </button>
    </div>
  )
}

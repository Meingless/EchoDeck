import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { useStore, currentBoardName } from '@/store/store'
import { usePlayer } from '@/store/player'
import { engine } from '@/lib/audio'

export function StatusBar() {
  const view = useStore((s) => s.view)
  const soundboards = useStore((s) => s.soundboards)
  const sounds = useStore((s) => s.sounds)
  const active = usePlayer((s) => s.active)
  const [rate, setRate] = useState<number | null>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    const t = setInterval(() => setRate(engine.sampleRate()), 1500)
    setRate(engine.sampleRate())
    void window.api.appInfo().then((i) => setVersion(i.version))
    return () => clearInterval(t)
  }, [])

  const boardName = currentBoardName(view, soundboards)
  const count = view === 'all' ? sounds.length : sounds.filter((s) => (view === 'favorites' ? s.favorite : view === 'recent' ? !!s.lastPlayedAt : s.soundboardId === view)).length

  return (
    <footer className="statusbar">
      <span>
        <strong>{boardName}</strong> · {count} {count === 1 ? 'sound' : 'sounds'}
      </span>
      <span className="dot" />
      {active.length > 0 && (
        <span className="playing-count">
          <Activity size={11} style={{ verticalAlign: -1.5, marginRight: 4 }} />
          {active.length} playing
        </span>
      )}
      <div className="statusbar-right">
        {rate && <span>{(rate / 1000).toFixed(1)} kHz</span>}
        {version && <span>v{version}</span>}
      </div>
    </footer>
  )
}

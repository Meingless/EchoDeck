import { useRef, useState } from 'react'
import { Search, Settings, Headphones, Volume2, Volume1, VolumeX, Square, X, Loader2 } from 'lucide-react'
import { useStore } from '@/store/store'
import { usePlayer } from '@/store/player'
import { Popover, DevicePopoverContent } from './Popover'
import { engine, listOutputDevices } from '@/lib/audio'
import { fmtPercent } from '@/lib/format'
import type { CSSProperties } from 'react'

function LogoMark({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <rect x="1.4" y="4.2" width="2.4" height="5.6" rx="1.2" />
      <rect x="5.8" y="1.6" width="2.4" height="10.8" rx="1.2" />
      <rect x="10.2" y="5.6" width="2.4" height="2.8" rx="1.2" />
    </svg>
  )
}

export function TopBar() {
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const openSettings = useStore((s) => s.openSettings)
  const stopAll = usePlayer((s) => s.stopAll)
  const active = usePlayer((s) => s.active)

  const [volOpen, setVolOpen] = useState(false)
  const [devOpen, setDevOpen] = useState(false)
  const [devices, setDevices] = useState<{ deviceId: string; label: string; isDefault: boolean }[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const volRef = useRef<HTMLButtonElement>(null)
  const devRef = useRef<HTMLButtonElement>(null)

  const openDevices = async () => {
    setDevOpen(true)
    setLoadingDevices(true)
    setDevices(await listOutputDevices())
    setLoadingDevices(false)
  }

  const pickDevice = (id: string | null, label: string) => {
    if (id === '__toggle_mute__') {
      setSettings({ muted: !settings.muted })
    } else {
      setSettings({ outputDeviceId: id })
      if (settings.virtualMic) {
        useStore.getState().toast('info', 'Virtual microphone is active', 'Output follows the virtual mic until it is disabled')
      } else {
        void engine.setOutputDevice(id).then((ok) => {
          if (!ok) useStore.getState().toast('error', 'Could not switch output device', label)
        })
      }
    }
    setDevOpen(false)
  }

  const vol = settings.muted ? 0 : settings.masterVolume
  const VolIcon = settings.muted ? VolumeX : vol > 0.5 ? Volume2 : Volume1

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <LogoMark />
        </div>
        <div className="brand-name">EchoDeck</div>
      </div>

      <div className="search-wrap">
        <span className="search-icon">
          <Search size={15} />
        </span>
        <input
          id="global-search"
          className="search-input"
          type="text"
          placeholder="Search sounds..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && search) {
              e.stopPropagation()
              setSearch('')
              e.currentTarget.blur()
            }
          }}
          spellCheck={false}
          aria-label="Search sounds"
        />
        {search ? (
          <button
            className="icon-btn search-clear"
            style={{ width: 22, height: 22 }}
            onClick={() => setSearch('')}
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        ) : (
          <span className="search-kbd">
            <kbd>Ctrl</kbd>
            <kbd>F</kbd>
          </span>
        )}
      </div>

      <div className="topbar-right">
        <button className={`stopall-btn${active.length ? ' playing' : ''}`} onClick={stopAll} disabled={!active.length} data-tip={active.length ? undefined : 'Stop all sounds'}>
          <Square size={13} strokeWidth={2.6} />
          <span className="btn-label">Stop All</span>
        </button>

        <div className="topbar-sep" />

        <button ref={devRef} className="icon-btn" onClick={openDevices} data-tip="Output device" aria-label="Output device" aria-haspopup="dialog" aria-expanded={devOpen}>
          <Headphones size={17} />
        </button>

        <button
          ref={volRef}
          className="icon-btn"
          onClick={() => setVolOpen((v) => !v)}
          data-tip="Master volume"
          aria-label="Master volume"
          aria-haspopup="dialog"
          aria-expanded={volOpen}
        >
          <VolIcon size={17} />
        </button>

        <div className="topbar-sep" />

        <button className="icon-btn" onClick={() => openSettings()} data-tip="Settings" aria-label="Settings">
          <Settings size={17} />
        </button>
      </div>

      {devOpen && (
        <Popover anchor={devRef.current} onClose={() => setDevOpen(false)} width={250}>
          {loadingDevices ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: 18 }}>
              <Loader2 size={16} className="spin" />
            </div>
          ) : (
            <DevicePopoverContent devices={devices} current={settings.outputDeviceId} onPick={pickDevice} />
          )}
        </Popover>
      )}

      {volOpen && (
        <Popover anchor={volRef.current} onClose={() => setVolOpen(false)} width={230}>
          <div className="popover-pad">
            <div className="popover-label" style={{ padding: 0 }}>
              Master Volume
            </div>
            <div className="volume-row" style={{ marginTop: 8 }}>
              <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setSettings({ muted: !settings.muted })} aria-label="Mute">
                <VolIcon size={15} />
              </button>
              <input
                type="range"
                className="slider"
                min={0}
                max={1}
                step={0.01}
                value={settings.masterVolume}
                style={{ '--fill': `${fmtPercent(settings.masterVolume)}` } as CSSProperties}
                onChange={(e) => setSettings({ masterVolume: Number(e.target.value), muted: false })}
                aria-label="Master volume"
              />
              <span className="volume-pct">{fmtPercent(settings.masterVolume)}</span>
            </div>
          </div>
        </Popover>
      )}
    </header>
  )
}

export { LogoMark }

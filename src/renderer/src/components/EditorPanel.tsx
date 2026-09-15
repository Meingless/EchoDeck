import { useEffect, useState } from 'react'
import { X, Star, Trash2 } from 'lucide-react'
import { useStore } from '@/store/store'
import { usePlayer } from '@/store/player'
import { Waveform } from './Waveform'
import { HotkeyCapture } from './HotkeyCapture'
import { ConfirmDialog } from './Modal'
import { fmtDuration, fmtSize, clamp } from '@/lib/format'
import type { CSSProperties } from 'react'
import type { Sound } from '@/lib/types'

export function EditorPanel() {
  const editingId = useStore((s) => s.editingId)
  const openEditor = useStore((s) => s.openEditor)
  const liveSound = useStore((s) => s.sounds.find((x) => x.id === s.editingId))
  const updateSound = useStore((s) => s.updateSound)
  const assignHotkey = useStore((s) => s.assignHotkey)
  const deleteSound = useStore((s) => s.deleteSound)
  const soundboards = useStore((s) => s.soundboards)
  const toggle = usePlayer((s) => s.toggle)
  const playing = usePlayer((s) => (editingId ? s.active.includes(editingId) : false))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lastSound, setLastSound] = useState<Sound | null>(null)

  useEffect(() => {
    if (liveSound) setLastSound(liveSound)
  }, [liveSound])

  const sound = liveSound ?? lastSound
  const open = !!liveSound

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') openEditor(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, openEditor])

  if (!sound) return null

  return (
    <aside className={`editor-panel${open ? ' open' : ''}`} aria-label="Sound editor">
      <div className="editor-header">
        <span className="editor-title">Edit Sound</span>
        <button className="icon-btn" onClick={() => openEditor(null)} aria-label="Close editor" data-tip="Close">
          <X size={17} />
        </button>
      </div>

      <div className="editor-body">
        <div>
          <input
            className="editor-name-input"
            value={sound.name}
            onChange={(e) => updateSound(sound.id, { name: e.target.value })}
            aria-label="Sound name"
            spellCheck={false}
          />
          <div className="editor-meta" style={{ padding: '6px 2px 0' }}>
            <span>{fmtDuration(sound.duration)}</span>
            {sound.size > 0 && (
              <>
                <span>·</span>
                <span>{fmtSize(sound.size)}</span>
              </>
            )}
            <span>·</span>
            <span>{soundboards.find((b) => b.id === sound.soundboardId)?.name ?? 'Unassigned'}</span>
            <span style={{ marginLeft: 'auto' }}>
              <button
                className="icon-btn"
                style={{ width: 26, height: 26 }}
                onClick={() => updateSound(sound.id, { favorite: !sound.favorite })}
                aria-label={sound.favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={14.5} fill={sound.favorite ? 'currentColor' : 'none'} color={sound.favorite ? 'var(--warning)' : undefined} />
              </button>
            </span>
          </div>
        </div>

        <button
          type="button"
          className="editor-wave"
          onClick={() => toggle(sound.id)}
          aria-label={playing ? 'Stop preview' : 'Play preview'}
          data-tip={playing ? 'Stop' : 'Click to preview'}
        >
          <Waveform sound={sound} large />
        </button>

        <div className="setting-group">
          <div className="setting-row">
            <div>
              <div className="setting-label">Volume</div>
              <div className="setting-desc">Applied when this sound plays</div>
            </div>
            <div className="setting-control" style={{ width: 150 }}>
              <input
                type="range"
                className="slider"
                min={0}
                max={1.5}
                step={0.01}
                value={sound.volume}
                style={{ '--fill': `${clamp((sound.volume / 1.5) * 100, 0, 100)}%` } as CSSProperties}
                onChange={(e) => updateSound(sound.id, { volume: Number(e.target.value) })}
                aria-label="Sound volume"
              />
              <span className="volume-pct">{Math.round(sound.volume * 100)}%</span>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Loop</div>
              <div className="setting-desc">Repeat until stopped</div>
            </div>
            <div className="setting-control">
              <button
                className={`switch${sound.loop ? ' on' : ''}`}
                onClick={() => updateSound(sound.id, { loop: !sound.loop })}
                role="switch"
                aria-checked={sound.loop}
                aria-label="Loop"
              />
            </div>
          </div>

          <div className="setting-row">
            <div style={{ minWidth: 0 }}>
              <div className="setting-label">Soundboard</div>
              <div className="setting-desc">Where this sound lives</div>
            </div>
            <div className="setting-control" style={{ width: 150 }}>
              <select
                className="native-select"
                value={sound.soundboardId}
                onChange={(e) => updateSound(sound.id, { soundboardId: e.target.value })}
                aria-label="Soundboard"
              >
                {soundboards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Global Hotkey</div>
              <div className="setting-desc">Works system-wide, even when EchoDeck is focused elsewhere</div>
            </div>
            <div className="setting-control">
              <HotkeyCapture
                value={sound.hotkey}
                onChange={(accel) => {
                  if (accel === null) {
                    updateSound(sound.id, { hotkey: null })
                    useStore.getState().syncHotkeys()
                  } else {
                    assignHotkey(sound.id, accel)
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="setting-group">
          <div className="setting-row">
            <div>
              <div className="setting-label" style={{ color: 'var(--danger)' }}>
                Delete sound
              </div>
              <div className="setting-desc">Removes it from the library and disk</div>
            </div>
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14.5} />
              Delete
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${sound.name}"?`}
          message={
            <>
              This permanently removes <strong>{sound.name}</strong> from your library and deletes the audio file.
            </>
          }
          onConfirm={() => {
            deleteSound(sound.id)
            openEditor(null)
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </aside>
  )
}

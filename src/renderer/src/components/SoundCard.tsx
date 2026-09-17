import { useRef, useState } from 'react'
import { Play, Square, Star, MoreHorizontal, Repeat } from 'lucide-react'
import { useStore } from '@/store/store'
import { usePlayer } from '@/store/player'
import { Waveform } from './Waveform'
import { KeyCaps } from './KeyCaps'
import { ConfirmDialog } from './Modal'
import { fmtDuration } from '@/lib/format'
import type { Sound } from '@/lib/types'

export function SoundCard({ sound, index }: { sound: Sound; index: number }) {
  const playing = usePlayer((s) => s.active.includes(sound.id))
  const toggle = usePlayer((s) => s.toggle)
  const openMenu = useStore((s) => s.openMenu)
  const openEditor = useStore((s) => s.openEditor)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const deleteSound = useStore((s) => s.deleteSound)
  const duplicate = useStore((s) => s.duplicateSound)
  const soundboards = useStore((s) => s.soundboards)
  const updateSound = useStore((s) => s.updateSound)
  const showHotkeys = useStore((s) => s.settings.showHotkeys)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const mainActionRef = useRef<HTMLDivElement>(null)

  const openCardMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openMenu(e.clientX, e.clientY, [
      {
        label: playing ? 'Stop' : 'Play',
        icon: playing ? 'stop' : 'play',
        onSelect: () => toggle(sound.id)
      },
      {
        label: sound.favorite ? 'Remove from Favorites' : 'Add to Favorites',
        icon: 'star',
        onSelect: () => toggleFavorite(sound.id)
      },
      { type: 'separator' },
      { label: 'Edit', icon: 'pencil', onSelect: () => openEditor(sound.id) },
      { label: 'Assign Hotkey', icon: 'keyboard', onSelect: () => openEditor(sound.id) },
      {
        label: 'Move to Soundboard',
        icon: 'move',
        children: soundboards.map((b) => ({
          label: b.name,
          checked: b.id === sound.soundboardId,
          onSelect: () => updateSound(sound.id, { soundboardId: b.id })
        }))
      },
      { type: 'separator' },
      { label: 'Duplicate', icon: 'copy', onSelect: () => duplicate(sound.id) },
      { label: 'Show in Folder', icon: 'folder-output', onSelect: () => window.api.revealSound(sound.fileName) },
      { label: 'Delete', icon: 'trash', danger: true, onSelect: () => setConfirmDelete(true) }
    ], mainActionRef.current ?? (e.currentTarget as HTMLElement))
  }

  return (
    <div
      className={`sound-card${playing ? ' playing' : ''}`}
      style={{ '--i': index } as React.CSSProperties}
      role="group"
      aria-label={`${sound.name}, ${fmtDuration(sound.duration)}`}
      onClick={() => toggle(sound.id)}
      onContextMenu={openCardMenu}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-sound-id', sound.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="card-main-row">
        <div
          className="card-main-action"
          ref={mainActionRef}
          role="button"
          tabIndex={0}
          data-index={index}
          aria-label={playing ? `Stop ${sound.name}` : `Play ${sound.name}`}
          onClick={(e) => {
            e.stopPropagation()
            toggle(sound.id)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggle(sound.id)
            }
          }}
        >
          <div className="card-top">
            <span className="card-name" title={sound.name}>
              {sound.name}
            </span>
            {playing && (
              <span className="card-playing-pill">
                <span className="card-playing-dot" />
                PLAYING
              </span>
            )}
          </div>
          <Waveform sound={sound} />
        </div>
        <div className="card-controls" onClick={(e) => e.stopPropagation()}>
          <button
            className={`card-fav${sound.favorite ? ' on' : ''}`}
            onClick={() => toggleFavorite(sound.id)}
            aria-label={sound.favorite ? 'Remove from favorites' : 'Add to favorites'}
            data-tip={sound.favorite ? 'Unfavorite' : 'Favorite'}
          >
            <Star size={14.5} fill={sound.favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            className="card-more"
            onClick={openCardMenu}
            aria-label={`Options for ${sound.name}`}
            data-tip="Options"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      <div className="card-footer" onClick={(e) => e.stopPropagation()}>
        <button
          className={`play-btn${playing ? ' playing' : ''}`}
          onClick={() => toggle(sound.id)}
          aria-label={playing ? `Stop ${sound.name}` : `Play ${sound.name}`}
          data-tip={playing ? 'Stop' : 'Play'}
        >
          {playing ? <Square size={12.5} strokeWidth={2.6} /> : <Play size={15} fill="currentColor" strokeWidth={0} style={{ marginLeft: 2 }} />}
        </button>
        <span className="card-duration">{fmtDuration(sound.duration)}</span>
        {sound.loop && (
          <span className="card-loop" data-tip="Loops">
            <Repeat size={12} />
          </span>
        )}
        {showHotkeys && (
          <span className="card-hotkeys">
            <KeyCaps accel={sound.hotkey} />
          </span>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${sound.name}"?`}
          message={
            <>
              This permanently removes <strong>{sound.name}</strong> from your library and deletes the audio file.
            </>
          }
          onConfirm={() => deleteSound(sound.id)}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

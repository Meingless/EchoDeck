import { useRef, useState } from 'react'
import { Library, Star, History, Plus, Settings as SettingsIcon, AudioLines } from 'lucide-react'
import { useStore } from '@/store/store'
import { useNavIndicator } from '@/hooks/useNavIndicator'
import type { Soundboard } from '@/lib/types'
import { ConfirmDialog } from './Modal'

const LIBRARY_ITEMS = [
  { id: 'all', icon: Library, label: 'All Sounds' },
  { id: 'favorites', icon: Star, label: 'Favorites' },
  { id: 'recent', icon: History, label: 'Recently Played' }
] as const

function BoardItem({
  board,
  renaming,
  setRenaming,
  justAddedRef
}: {
  board: Soundboard
  renaming: string | null
  setRenaming: (id: string | null) => void
  justAddedRef: { current: string | null }
}) {
  const view = useStore((s) => s.view)
  const sounds = useStore((s) => s.sounds)
  const setView = useStore((s) => s.setView)
  const renameBoard = useStore((s) => s.renameSoundboard)
  const duplicateBoard = useStore((s) => s.duplicateSoundboard)
  const deleteBoard = useStore((s) => s.deleteSoundboard)
  const openMenu = useStore((s) => s.openMenu)
  const updateSound = useStore((s) => s.updateSound)
  const importPaths = useStore((s) => s.importPaths)
  const [dropHover, setDropHover] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const count = sounds.filter((s) => s.soundboardId === board.id).length
  const active = view === board.id
  const isNew = justAddedRef.current === board.id

  const startRename = () => setRenaming(board.id)

  const commit = (value: string) => {
    const trimmed = value.trim()
    if (trimmed) {
      renameBoard(board.id, trimmed)
    } else if (isNew) {
      deleteBoard(board.id, true)
    }
    justAddedRef.current = null
    setRenaming(null)
  }

  const cancel = () => {
    if (isNew) deleteBoard(board.id, true)
    justAddedRef.current = null
    setRenaming(null)
  }

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    openMenu(e.clientX, e.clientY, [
      { label: 'Rename', icon: 'pencil', onSelect: startRename },
      { label: 'Duplicate', icon: 'copy', onSelect: () => duplicateBoard(board.id) },
      { type: 'separator' },
      { label: 'Delete', icon: 'trash', danger: true, onSelect: () => setConfirmDelete(true) }
    ], e.currentTarget as HTMLElement)
  }

  if (renaming === board.id) {
    return (
      <>
        <div className={`nav-item${active ? ' active' : ''}`}>
          <input
            className="nav-rename-input"
            defaultValue={board.name}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') commit(e.currentTarget.value)
              if (e.key === 'Escape') cancel()
            }}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <button
        className={`nav-item${active ? ' active' : ''}${dropHover ? ' drop-target' : ''}`}
        onClick={() => setView(board.id)}
        onDoubleClick={startRename}
        onContextMenu={onContextMenu}
        draggable={!renaming}
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-board-id', board.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={(e) => {
          const types = e.dataTransfer.types
          if (types.includes('application/x-board-id') || types.includes('Files') || types.includes('application/x-sound-id')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = types.includes('Files') ? 'copy' : 'move'
            setDropHover(true)
          }
        }}
        onDragLeave={() => setDropHover(false)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDropHover(false)
          const soundId = e.dataTransfer.getData('application/x-sound-id')
          if (soundId) {
            updateSound(soundId, { soundboardId: board.id })
            return
          }
          if (e.dataTransfer.files.length) {
            const paths = [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter((p): p is string => !!p)
            if (paths.length) void importPaths(paths, board.id)
            return
          }
          const dragged = e.dataTransfer.getData('application/x-board-id')
          if (dragged && dragged !== board.id) {
            const ids = useStore.getState().soundboards.map((b) => b.id).filter((id) => id !== dragged)
            ids.splice(ids.indexOf(board.id), 0, dragged)
            useStore.getState().reorderSoundboards(ids)
          }
        }}
        title={board.name}
      >
        <AudioLines size={15.5} />
        <span className="nav-label">{board.name}</span>
        <span className="nav-count">{count}</span>
      </button>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete soundboard?"
          message={
            <>
              This will remove <strong>{board.name}</strong> and all sounds on it.
            </>
          }
          onConfirm={() => deleteBoard(board.id)}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

export function Sidebar() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const sounds = useStore((s) => s.sounds)
  const soundboards = useStore((s) => s.soundboards)
  const addBoard = useStore((s) => s.addSoundboard)
  const openSettings = useStore((s) => s.openSettings)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const [renaming, setRenaming] = useState<string | null>(null)
  const justAddedRef = useRef<string | null>(null)
  const { ref: sidebarRef, pos: indicator } = useNavIndicator<HTMLElement>()

  const counts = {
    all: sounds.length,
    favorites: sounds.filter((s) => s.favorite).length,
    recent: sounds.filter((s) => s.lastPlayedAt).length
  }

  return (
    <aside className="sidebar" ref={sidebarRef}>
      <div
        className="nav-indicator"
        style={{ transform: `translateY(${indicator.top}px)`, opacity: indicator.opacity }}
        aria-hidden
      />
      <div className="nav-section">
        <div className="nav-heading">
          <span className="eyebrow">Library</span>
        </div>
        {LIBRARY_ITEMS.map((item) => (
          <button key={item.id} className={`nav-item${view === item.id ? ' active' : ''}`} onClick={() => setView(item.id)}>
            <item.icon size={15.5} />
            <span className="nav-label">{item.label}</span>
            <span className="nav-count">{counts[item.id]}</span>
          </button>
        ))}
      </div>

      <div className="nav-section">
        <div className="nav-heading">
          <span className="eyebrow">Soundboards</span>
          <button
            className="nav-add"
            onClick={() => {
              const id = addBoard('New Soundboard')
              justAddedRef.current = id
              setRenaming(id)
            }}
            aria-label="New soundboard"
            data-tip="New soundboard"
          >
            <Plus size={14} />
          </button>
        </div>
        {soundboards.map((b) => (
          <BoardItem key={b.id} board={b} renaming={renaming} setRenaming={setRenaming} justAddedRef={justAddedRef} />
        ))}
        {soundboards.length === 0 && (
          <div style={{ padding: '4px 14px 8px', fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>No soundboards yet</div>
        )}
      </div>

      <div className="sidebar-spacer" />

      <button className={`nav-item${settingsOpen ? ' active' : ''}`} onClick={() => openSettings()}>
        <SettingsIcon size={15.5} />
        <span className="nav-label">Settings</span>
      </button>
    </aside>
  )
}

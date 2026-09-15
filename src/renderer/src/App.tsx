import { useEffect, useMemo, useState } from 'react'
import { Plus, CloudUpload } from 'lucide-react'
import { useStore, currentBoardName } from '@/store/store'
import { usePlayer } from '@/store/player'
import { fuzzyMatch } from '@/lib/fuzzy'
import { eventToAccelerator, acceleratorEquals } from '@/lib/hotkeys'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { SoundGrid, MainHeaderFilters } from './components/SoundGrid'
import { EditorPanel } from './components/EditorPanel'
import { SettingsOverlay } from './components/Settings'
import { CommandPalette } from './components/CommandPalette'
import { PlaybackBar } from './components/PlaybackBar'
import { StatusBar } from './components/StatusBar'
import { ContextMenuLayer } from './components/ContextMenu'
import { Toasts } from './components/Toasts'
import { AddSoundModal } from './components/AddSoundModal'

function MainHeader() {
  const view = useStore((s) => s.view)
  const soundboards = useStore((s) => s.soundboards)
  const setAddOpen = useStore((s) => s.setAddOpen)
  const visible = useVisibleCount()

  return (
    <div className="main-header">
      <div className="main-header-top">
        <div>
          <div className="main-title">{currentBoardName(view, soundboards)}</div>
          <div className="main-count">
            {visible} {visible === 1 ? 'sound' : 'sounds'}
          </div>
        </div>
        <div className="main-header-actions">
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} />
            Add Sound
          </button>
        </div>
      </div>
      <MainHeaderFilters />
    </div>
  )
}

export function useVisibleCount(): number {
  const sounds = useStore((s) => s.sounds)
  const soundboards = useStore((s) => s.soundboards)
  const view = useStore((s) => s.view)
  const filter = useStore((s) => s.filter)
  const search = useStore((s) => s.search)
  return useMemo(() => {
    let items = sounds
    if (view === 'favorites') items = items.filter((s) => s.favorite)
    else if (view === 'recent') items = items.filter((s) => s.lastPlayedAt)
    else if (soundboards.some((b) => b.id === view)) items = items.filter((s) => s.soundboardId === view)
    if (filter === 'favorites') items = items.filter((s) => s.favorite)
    else if (filter === 'played') items = items.filter((s) => s.playCount > 0)
    else if (filter === 'recent') items = items.filter((s) => Date.now() - s.addedAt < 7 * 864e5)
    if (search.trim()) {
      return items.filter((s) => fuzzyMatch(s.name, search) !== null).length
    }
    return items.length
  }, [sounds, soundboards, view, filter, search])
}

export function App() {
  const loaded = useStore((s) => s.loaded)
  const importPaths = useStore((s) => s.importPaths)
  const [dragDepth, setDragDepth] = useState(0)

  useEffect(() => {
    void useStore.getState().init()
    window.api.onTriggerSound((id) => {
      const { toggle } = usePlayer.getState()
      toggle(id)
    })
    window.api.onStopAll(() => usePlayer.getState().stopAll())
    window.api.onGlobalShortcutStatus((status) => {
      useStore.getState().setHotkeyStatus(status)
      if (!status.ok) {
        useStore.getState().toast(
          'warning',
          'Some global shortcuts failed to register',
          'Open Settings → Hotkeys for details. In-app hotkeys still work.'
        )
      }
    })

    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const s = useStore.getState()
        s.setPalette(!s.paletteOpen)
      } else if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        const el = document.getElementById('global-search') as HTMLInputElement | null
        el?.focus()
        el?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // In-app hotkey fallback: on Wayland, globalShortcut may be unavailable,
  // so match assigned hotkeys directly while the window is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')) return
      if (e.key === 'Escape') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      if (document.querySelector('.hotkey-box.listening')) return
      if (useStore.getState().paletteOpen) return
      const accel = eventToAccelerator(e)
      if (!accel || acceleratorEquals(accel, 'Ctrl+F') || acceleratorEquals(accel, 'Ctrl+K')) return
      const { sounds, settings } = useStore.getState()
      const match = sounds.find((s) => s.hotkey && acceleratorEquals(s.hotkey, accel))
      if (match) {
        e.preventDefault()
        usePlayer.getState().toggle(match.id)
        return
      }
      if (settings.stopAllHotkey && acceleratorEquals(settings.stopAllHotkey, accel)) {
        e.preventDefault()
        usePlayer.getState().stopAll()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setDragDepth(depth)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onLeave = () => {
      depth = Math.max(0, depth - 1)
      setDragDepth(depth)
    }
    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragDepth(0)
      if (e.dataTransfer?.files.length) {
        const paths = [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter((p): p is string => !!p)
        if (paths.length) await importPaths(paths)
      }
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [importPaths])

  if (!loaded) return <div className="app" />

  return (
    <div className="app">
      <TopBar />
      <Sidebar />
      <main className="main">
        <MainHeader />
        <SoundGrid />
        <EditorPanel />
        <SettingsOverlay />
        <PlaybackBar />
        <CommandPalette />
        {dragDepth > 0 && (
          <div className="dnd-overlay">
            <div className="dnd-inner">
              <CloudUpload size={34} strokeWidth={1.6} />
              Drop to import sounds
            </div>
          </div>
        )}
      </main>
      <StatusBar />
      <ContextMenuLayer />
      <AddSoundModal />
      <Toasts />
    </div>
  )
}

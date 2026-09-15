import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/store/store'
import { usePlayer } from '@/store/player'
import { fuzzyMatch } from '@/lib/fuzzy'
import { ICONS } from './icons'
import { Play, Plus, Settings, Square, FolderPlus, Star, History } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Entry = { id: string; label: string; cat: string; icon: LucideIcon; run: () => void }

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen)
  const setPalette = useStore((s) => s.setPalette)
  const sounds = useStore((s) => s.sounds)
  const soundboards = useStore((s) => s.soundboards)
  const toggle = usePlayer((s) => s.toggle)
  const stopAll = usePlayer((s) => s.stopAll)
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = []
    for (const s of sounds) {
      list.push({
        id: `play-${s.id}`,
        label: s.name,
        cat: 'Sound',
        icon: Play,
        run: () => toggle(s.id)
      })
    }
    list.push(
      { id: 'stop-all', label: 'Stop All', cat: 'Action', icon: Square, run: () => stopAll() },
      {
        id: 'import',
        label: 'Import Sound',
        cat: 'Action',
        icon: Plus,
        run: () => useStore.getState().setAddOpen(true)
      },
      {
        id: 'new-board',
        label: 'New Soundboard',
        cat: 'Action',
        icon: FolderPlus,
        run: () => useStore.getState().addSoundboard('New Soundboard')
      },
      { id: 'settings', label: 'Open Settings', cat: 'Action', icon: Settings, run: () => useStore.getState().openSettings() },
      {
        id: 'favorites',
        label: 'Go to Favorites',
        cat: 'Navigate',
        icon: Star,
        run: () => useStore.getState().setView('favorites')
      },
      {
        id: 'recent',
        label: 'Go to Recently Played',
        cat: 'Navigate',
        icon: History,
        run: () => useStore.getState().setView('recent')
      }
    )
    for (const b of soundboards) {
      list.push({ id: `view-${b.id}`, label: b.name, cat: 'Soundboard', icon: ICONS.list, run: () => useStore.getState().setView(b.id) })
    }
    return list
  }, [sounds, soundboards, toggle, stopAll])

  const filtered = useMemo(() => {
    if (!query.trim()) return entries.slice(0, 40)
    return entries
      .map((e) => ({ e, m: fuzzyMatch(e.label, query) }))
      .filter((x) => x.m)
      .sort((a, b) => (b.m!.score ?? 0) - (a.m!.score ?? 0))
      .slice(0, 40)
      .map((x) => x.e)
  }, [entries, query])

  useEffect(() => setSel(0), [filtered.length, query])

  if (!open) return null

  const runEntry = (e: Entry) => {
    setPalette(false)
    e.run()
  }

  return (
    <div className="palette-overlay" onPointerDown={(e) => e.target === e.currentTarget && setPalette(false)}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <div className="palette-input-wrap">
          <ICONS.command size={16} />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Type a command or search sounds..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSel((s) => Math.min(filtered.length - 1, s + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSel((s) => Math.max(0, s - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const entry = filtered[sel]
                if (entry) runEntry(entry)
              } else if (e.key === 'Escape') {
                setPalette(false)
              }
            }}
            aria-label="Command palette input"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {filtered.map((e, i) => (
            <button
              key={e.id}
              className={`palette-item${i === sel ? ' selected' : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => runEntry(e)}
            >
              <span className="pi-icon">
                <e.icon size={15.5} />
              </span>
              <span className="pi-label">{e.label}</span>
              <span className="pi-cat">{e.cat}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-md)' }}>
              No matching commands
            </div>
          )}
        </div>
        <div className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> run
          </span>
          <span style={{ marginLeft: 'auto' }}>EchoDeck</span>
        </div>
      </div>
    </div>
  )
}

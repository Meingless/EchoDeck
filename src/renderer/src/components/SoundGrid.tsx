import { useMemo, useRef, type ReactNode } from 'react'
import { Plus, SearchX, Star, Import } from 'lucide-react'
import { useStore } from '@/store/store'
import { SoundCard } from './SoundCard'
import { fuzzyMatch } from '@/lib/fuzzy'
import type { Sound } from '@/lib/types'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent', label: 'Recently Added' },
  { id: 'played', label: 'Most Played' }
] as const

function EmptyState({
  icon,
  title,
  desc,
  action
}: {
  icon: ReactNode
  title: string
  desc: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-desc">{desc}</div>
      {action}
    </div>
  )
}

export function SoundGrid() {
  const sounds = useStore((s) => s.sounds)
  const soundboards = useStore((s) => s.soundboards)
  const view = useStore((s) => s.view)
  const filter = useStore((s) => s.filter)
  const search = useStore((s) => s.search)
  const setAddOpen = useStore((s) => s.setAddOpen)
  const setSearch = useStore((s) => s.setSearch)
  const gridRef = useRef<HTMLDivElement>(null)

  const list = useMemo<Sound[]>(() => {
    let items = sounds

    if (view === 'favorites') items = items.filter((s) => s.favorite)
    else if (view === 'recent') items = items.filter((s) => s.lastPlayedAt)
    else if (soundboards.some((b) => b.id === view)) items = items.filter((s) => s.soundboardId === view)

    if (filter === 'favorites') items = items.filter((s) => s.favorite)
    else if (filter === 'played') items = items.filter((s) => s.playCount > 0)
    else if (filter === 'recent') items = items.filter((s) => Date.now() - s.addedAt < 7 * 864e5)

    if (search.trim()) {
      const scored = items
        .map((s) => ({ s, m: fuzzyMatch(s.name, search) }))
        .filter((x) => x.m)
        .sort((a, b) => (b.m!.score ?? 0) - (a.m!.score ?? 0))
      return scored.map((x) => x.s)
    }

    const sorted = [...items]
    if (filter === 'played') sorted.sort((a, b) => b.playCount - a.playCount || b.addedAt - a.addedAt)
    else if (filter === 'recent') sorted.sort((a, b) => b.addedAt - a.addedAt)
    else if (view === 'recent') sorted.sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    else sorted.sort((a, b) => a.name.localeCompare(b.name))
    return sorted
  }, [sounds, soundboards, view, filter, search])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-index]')
    if (!target) return
    const idx = Number(target.dataset.index)
    let next = -1
    if (e.key === 'ArrowRight') next = idx + 1
    else if (e.key === 'ArrowLeft') next = idx - 1
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const grid = gridRef.current
      if (!grid) return
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length
      next = e.key === 'ArrowDown' ? idx + cols : idx - cols
    } else return
    e.preventDefault()
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('[data-index]')
    if (cards && next >= 0 && next < cards.length) cards[next]?.focus()
  }

  let empty: ReactNode = null
  if (list.length === 0) {
    if (search.trim()) {
      empty = (
        <EmptyState
          icon={<SearchX size={24} />}
          title={`No results for "${search}"`}
          desc="Try a different search term."
          action={
            <button className="btn" onClick={() => setSearch('')}>
              Clear search
            </button>
          }
        />
      )
    } else if (sounds.length === 0) {
      empty = (
        <EmptyState
          icon={<Import size={24} />}
          title="No sounds yet"
          desc="Your soundboard is empty. Drop audio files anywhere or import them."
          action={
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <Plus size={15} />
              Import Sounds
            </button>
          }
        />
      )
    } else if (filter === 'favorites') {
      empty = (
        <EmptyState icon={<Star size={22} />} title="No favorites yet" desc="Star sounds to keep them close." />
      )
    } else {
      empty = (
        <EmptyState
          icon={<Import size={22} />}
          title="Nothing here yet"
          desc="Import sounds to fill this collection."
          action={
            <button className="btn" onClick={() => setAddOpen(true)}>
              <Plus size={15} />
              Add Sound
            </button>
          }
        />
      )
    }
  }

  return (
    <div className="grid-scroll">
      {list.length > 0 ? (
        <div className="sound-grid" ref={gridRef} onKeyDown={onKeyDown}>
          {list.map((s, i) => (
            <SoundCard key={s.id} sound={s} index={i} />
          ))}
        </div>
      ) : (
        empty
      )}
    </div>
  )
}

export function MainHeaderFilters() {
  const filter = useStore((s) => s.filter)
  const setFilter = useStore((s) => s.setFilter)
  const view = useStore((s) => s.view)
  if (view === 'recent') return <div />
  return (
    <div className="main-filters">
      {FILTERS.map((f) => (
        <button key={f.id} className={`chip${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>
          {f.label}
        </button>
      ))}
    </div>
  )
}

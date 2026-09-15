import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '@/store/store'
import { ICONS } from './icons'
import type { MenuItem } from '@/lib/types'
import { Check } from 'lucide-react'

function MenuList({ items, x, y, depth = 0 }: { items: MenuItem[]; x: number; y: number; depth?: number }) {
  const closeMenu = useStore((s) => s.closeMenu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const [sub, setSub] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let nx = x
    let ny = y
    if (nx + r.width > vw - 8) nx = Math.max(8, (depth > 0 ? x - r.width - 8 : vw - r.width - 8))
    if (ny + r.height > vh - 8) ny = Math.max(8, vh - r.height - 8)
    setPos({ x: nx, y: ny })
  }, [x, y, depth])

  return (
    <>
      <div className="ctx-menu" style={{ left: pos.x, top: pos.y }} role="menu" ref={ref}>
        {items.map((item, i) =>
          item.type === 'separator' ? (
            <div key={i} className="ctx-sep" />
          ) : (
            <button
              key={i}
              className={`ctx-item${item.danger ? ' danger' : ''}${item.disabled ? ' disabled' : ''}${
                item.checked ? ' has-check' : ''
              }`}
              role="menuitem"
              onMouseEnter={(e) => {
                if (item.children) {
                  const r = e.currentTarget.getBoundingClientRect()
                  setSub({ x: r.right + 4, y: r.top - 5, items: item.children })
                } else {
                  setSub(null)
                }
              }}
              onClick={() => {
                if (item.children) return
                closeMenu()
                item.onSelect?.()
              }}
            >
              {item.checked && (
                <span className="ctx-check">
                  <Check size={13} />
                </span>
              )}
              {item.icon && (
                <span className="ctx-icon">
                  {(() => {
                    const Icon = ICONS[item.icon] ?? ICONS.music
                    return <Icon size={14.5} />
                  })()}
                </span>
              )}
              <span className="ctx-label">{item.label}</span>
              {item.shortcut && (
                <span className="ctx-shortcut">
                  {item.shortcut.map((k, j) => (
                    <kbd key={j}>{k}</kbd>
                  ))}
                </span>
              )}
            </button>
          )
        )}
      </div>
      {sub && <MenuList items={sub.items} x={sub.x} y={sub.y} depth={depth + 1} />}
    </>
  )
}

export function ContextMenuLayer() {
  const menu = useStore((s) => s.menu)
  const closeMenu = useStore((s) => s.closeMenu)

  useEffect(() => {
    if (!menu) return
    const close = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('.ctx-menu')) return
      closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [menu, closeMenu])

  if (!menu) return null
  return <MenuList items={menu.items} x={menu.x} y={menu.y} />
}

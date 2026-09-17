import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '@/store/store'
import { ICONS } from './icons'
import type { MenuItem } from '@/lib/types'
import { Check } from 'lucide-react'

function MenuList({
  items,
  x,
  y,
  depth = 0,
  onCloseSub
}: {
  items: MenuItem[]
  x: number
  y: number
  depth?: number
  onCloseSub?: () => void
}) {
  const closeMenu = useStore((s) => s.closeMenu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const [sub, setSub] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const submenuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const itemButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({})

  const openSubmenu = (button: HTMLButtonElement, children: MenuItem[]) => {
    submenuTriggerRef.current = button
    const r = button.getBoundingClientRect()
    setSub({ x: r.right + 4, y: r.top - 5, items: children })
  }

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not([disabled])')
    first?.focus()
  }, [depth])

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
      <div className="ctx-menu" style={{ left: pos.x, top: pos.y }} role="menu" aria-label="Context menu" ref={ref}>
        {items.map((item, i) =>
          item.type === 'separator' ? (
            <div key={i} className="ctx-sep" role="separator" />
          ) : (
            <button
              key={i}
              ref={(el) => {
                itemButtonRefs.current[i] = el
              }}
              className={`ctx-item${item.danger ? ' danger' : ''}${item.disabled ? ' disabled' : ''}${
                item.checked ? ' has-check' : ''
              }`}
              tabIndex={item.disabled ? -1 : 0}
              disabled={item.disabled}
              aria-haspopup={item.children ? 'menu' : undefined}
              aria-expanded={item.children ? sub?.items === item.children : undefined}
              onKeyDown={(e) => {
                const menu = e.currentTarget.parentElement
                if (!menu) return
                const enabled = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not([disabled])'))
                const index = enabled.indexOf(e.currentTarget)
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
                  e.preventDefault()
                  const next = e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? enabled.length - 1
                      : (index + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length
                  enabled[next]?.focus()
                } else if (e.key === 'ArrowLeft' && depth > 0) {
                  e.preventDefault()
                  onCloseSub?.()
                } else if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (item.children) {
                    openSubmenu(e.currentTarget, item.children)
                  } else {
                    closeMenu()
                    item.onSelect?.()
                  }
                } else if (e.key === 'ArrowRight' && item.children) {
                  e.preventDefault()
                  openSubmenu(e.currentTarget, item.children)
                }
              }}
              onMouseEnter={(e) => {
                if (item.children) {
                  openSubmenu(e.currentTarget, item.children)
                } else {
                  setSub(null)
                }
              }}
              onClick={() => {
                if (item.children) {
                  const trigger = itemButtonRefs.current[i]
                  if (trigger) openSubmenu(trigger, item.children)
                  return
                }
                closeMenu()
                item.onSelect?.()
              }}
              role={item.checked !== undefined ? 'menuitemradio' : 'menuitem'}
              aria-checked={item.checked === undefined ? undefined : item.checked}
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
      {sub && (
        <MenuList
          items={sub.items}
          x={sub.x}
          y={sub.y}
          depth={depth + 1}
          onCloseSub={() => {
            setSub(null)
            submenuTriggerRef.current?.focus()
          }}
        />
      )}
    </>
  )
}

export function ContextMenuLayer() {
  const menu = useStore((s) => s.menu)
  const closeMenu = useStore((s) => s.closeMenu)

  useEffect(() => {
    if (!menu) return
    const invoker = menu.invoker ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
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
      if (invoker?.isConnected) invoker.focus()
    }
  }, [menu, closeMenu])

  if (!menu) return null
  return <MenuList items={menu.items} x={menu.x} y={menu.y} />
}

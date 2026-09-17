import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Volume2, VolumeX } from 'lucide-react'

export function Popover({
  anchor,
  onClose,
  children,
  align = 'end',
  width
}: {
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end'
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [pos, setPos] = useState({ x: -1000, y: -1000 })

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const r = anchor.getBoundingClientRect()
    const me = ref.current.getBoundingClientRect()
    let x = align === 'end' ? r.right - me.width : r.left
    x = Math.max(8, Math.min(x, window.innerWidth - me.width - 8))
    let y = r.bottom + 6
    if (y + me.height > window.innerHeight - 8) y = r.top - me.height - 6
    setPos({ x, y })
  }, [anchor, align])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const initialFocus = ref.current?.querySelector<HTMLElement>(
      'button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"]):not([hidden])'
    )
    initialFocus?.focus()
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onCloseRef.current()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', onKey)
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [anchor])

  return (
    <div ref={ref} className="popover" role="dialog" aria-label="Popover" tabIndex={-1} style={{ left: pos.x, top: pos.y, ...(width ? { width } : {}) }}>
      {children}
    </div>
  )
}

export function DevicePopoverContent({
  devices,
  current,
  onPick
}: {
  devices: { deviceId: string; label: string; isDefault: boolean }[]
  current: string | null
  onPick: (id: string | null, label: string) => void
}) {
  const activeIsDefault = !current || current === devices.find((d) => d.isDefault)?.deviceId
  return (
    <>
      <div className="popover-label">Output Device</div>
      <button className="device-item" onClick={() => onPick(null, 'System Default')}>
        <Volume2 size={15} />
        <span style={{ flex: 1 }}>System Default</span>
        {activeIsDefault && <span className="check">{<Check size={14} />}</span>}
      </button>
      {devices
        .filter((d) => !d.isDefault && d.deviceId !== 'communications' && !d.label.startsWith('EchoDeck'))
        .map((d) => (
          <button key={d.deviceId} className="device-item" onClick={() => onPick(d.deviceId, d.label)} title={d.label}>
            <Volume2 size={15} />
            <span
              style={{
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 220
              }}
            >
              {d.label}
            </span>
            {current === d.deviceId && (
              <span className="check">
                <Check size={14} />
              </span>
            )}
          </button>
        ))}
      <div className="ctx-sep" />
      <button className="device-item" onClick={() => onPick('__toggle_mute__', '')}>
        <VolumeX size={15} />
        <span>Mute output</span>
      </button>
    </>
  )
}

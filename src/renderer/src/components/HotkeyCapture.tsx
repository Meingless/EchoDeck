import { useEffect, useRef, useState } from 'react'
import { eventToAccelerator, acceleratorToKeys } from '@/lib/hotkeys'

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'])

let activeCancel: (() => void) | null = null

export function HotkeyCapture({
  value,
  onChange,
  placeholder = 'None'
}: {
  value: string | null
  onChange: (accel: string | null) => boolean | void
  placeholder?: string
}) {
  const [listening, setListening] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)

  const endListening = () => {
    setListening(false)
    setPreview(null)
    if (activeCancel === cancelRef.current) activeCancel = null
  }

  const startListening = () => {
    activeCancel?.()
    setPreview(null)
    setListening(true)
    cancelRef.current = () => {
      setListening(false)
      setPreview(null)
    }
    activeCancel = cancelRef.current
  }

  useEffect(() => {
    if (!listening) return
    window.api.suspendHotkeys()
    const onBlur = () => endListening()
    window.addEventListener('blur', onBlur)
    return () => {
      window.api.resumeHotkeys()
      window.removeEventListener('blur', onBlur)
      if (activeCancel === cancelRef.current) activeCancel = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening])

  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        endListening()
        return
      }
      const accel = eventToAccelerator(e)
      if (accel) {
        const ok = onChange(accel)
        if (ok !== false) {
          endListening()
        } else {
          setPreview(null)
        }
        return
      }
      if (MODIFIERS.has(e.key)) {
        const parts: string[] = []
        if (e.ctrlKey) parts.push('Ctrl')
        if (e.metaKey) parts.push('Super')
        if (e.altKey) parts.push('Alt')
        if (e.shiftKey) parts.push('Shift')
        setPreview(parts.length ? `${parts.join('+')} + …` : null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, onChange])

  const shown = listening ? preview : value

  return (
    <div className="capture-row">
      <button
        className={`hotkey-box${listening ? ' listening' : ''}`}
        onClick={startListening}
        aria-label={listening ? 'Press any key combination' : 'Change hotkey'}
      >
        {listening ? (
          <>
            <span className="blink">●</span> {shown ?? 'Press keys…'}
          </>
        ) : shown ? (
          acceleratorToKeys(shown).map((k, i) => <kbd key={i}>{k}</kbd>)
        ) : (
          <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>{placeholder}</span>
        )}
      </button>
      {!listening && value && (
        <button
          className="btn btn-ghost"
          onClick={() => {
            onChange(null)
          }}
        >
          Clear
        </button>
      )}
      {listening && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>Esc cancels</span>}
    </div>
  )
}

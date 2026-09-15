const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'])

const NAME_FIX: Record<string, string> = {
  ' ': 'Space',
  Escape: 'Esc',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  AudioVolumeUp: 'Volume Up',
  AudioVolumeDown: 'Volume Down',
  MediaPlayPause: 'Media Play',
  MediaStop: 'Media Stop',
  MediaTrackNext: 'Media Next',
  MediaTrackPrevious: 'Media Prev'
}

export function eventToAccelerator(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.metaKey) parts.push('Super')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let key = NAME_FIX[e.key] ?? e.key
  if (/^[a-z]$/i.test(key)) key = key.toUpperCase()
  else if (/^[0-9]$/.test(key)) key = key
  else if (/^(?:F[1-9]|F1[0-9]|F2[0-4])$/.test(key)) key = key
  else if (e.code?.startsWith('Key')) key = e.code.slice(3)
  else if (e.code?.startsWith('Digit')) key = e.code.slice(5)
  else if (e.code?.startsWith('Numpad')) key = 'Num ' + (e.code.slice(6) || '')
  else if (['Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Backspace', 'Tab', 'Enter'].includes(e.key)) key = NAME_FIX[e.key] ?? e.key

  if (!key || key.length > 16) return null
  parts.push(key)
  return parts.join('+')
}

export function acceleratorToKeys(accel: string | null | undefined): string[] {
  if (!accel) return []
  return accel.split('+').map((k) => (k.length === 1 ? k.toUpperCase() : k))
}

export function acceleratorEquals(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const aliases: Record<string, string> = {
    control: 'ctrl',
    ctrl: 'ctrl',
    alt: 'alt',
    shift: 'shift',
    meta: 'super',
    super: 'super'
  }
  const modifierOrder = ['ctrl', 'alt', 'shift', 'super']
  const norm = (s: string) => {
    const parts = s
      .split('+')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
    const modifiers = parts.filter((part) => modifierOrder.includes(aliases[part] ?? part)).map((part) => aliases[part] ?? part)
    const keys = parts.filter((part) => !modifierOrder.includes(aliases[part] ?? part))
    modifiers.sort((x, y) => modifierOrder.indexOf(x) - modifierOrder.indexOf(y))
    return [...modifiers, ...keys].join('+')
  }
  return norm(a) === norm(b)
}

export const RESERVED = new Set([
  'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+A', 'Ctrl+S', 'Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+P',
  'Alt+Tab', 'Alt+F4', 'Ctrl+Alt+T', 'Super', 'Ctrl+K', 'Ctrl+F'
])

export function isReserved(accel: string | null): boolean {
  if (!accel) return false
  // Compare modifiers without relying on their order or casing, since
  // accelerators can come from either keyboard capture or persisted state.
  return [...RESERVED].some((reserved) => acceleratorEquals(accel, reserved))
}

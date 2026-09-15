export type AccentId = 'violet' | 'blue' | 'cyan' | 'green' | 'amber' | 'pink'

export type LatencyMode = 'low' | 'balanced' | 'efficient'

export type Settings = {
  accent: AccentId
  masterVolume: number
  muted: boolean
  outputDeviceId: string | null
  latencyMode: LatencyMode
  virtualMic: boolean
  virtualMicMonitor: boolean
  virtualMicIncludeMic: boolean
  stopOthersOnPlay: boolean
  showPlaybackBar: boolean
  notifications: boolean
  showHotkeys: boolean
  reduceMotion: boolean
  launchAtLogin: boolean
  stopAllHotkey: string | null
  seeded?: boolean
  seedDemo?: string[]
}

export const defaultSettings: Settings = {
  accent: 'violet',
  masterVolume: 0.9,
  muted: false,
  outputDeviceId: null,
  latencyMode: 'balanced',
  virtualMic: false,
  virtualMicMonitor: false,
  virtualMicIncludeMic: true,
  stopOthersOnPlay: false,
  showPlaybackBar: true,
  notifications: true,
  showHotkeys: true,
  reduceMotion: false,
  launchAtLogin: false,
  stopAllHotkey: null
}

export type Sound = {
  id: string
  name: string
  fileName: string
  duration: number
  peaks: number[]
  volume: number
  loop: boolean
  hotkey: string | null
  favorite: boolean
  soundboardId: string
  playCount: number
  lastPlayedAt: number | null
  addedAt: number
  size: number
}

export type Soundboard = { id: string; name: string }

export type ViewId = 'all' | 'favorites' | 'recent' | string
export type FilterId = 'all' | 'favorites' | 'recent' | 'played'
export type SortId = 'added' | 'name' | 'played' | 'recent'

export type ToastKind = 'success' | 'warning' | 'error' | 'info'

export type Toast = { id: number; kind: ToastKind; title: string; message?: string }

export type MenuItem =
  | { type: 'separator' }
  | {
      type?: 'item'
      label: string
      icon?: string
      shortcut?: string[]
      danger?: boolean
      disabled?: boolean
      checked?: boolean
      children?: MenuItem[]
      onSelect?: () => void
    }

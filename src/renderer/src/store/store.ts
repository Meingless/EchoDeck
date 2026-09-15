import { create } from 'zustand'
import type { FilterId, MenuItem, Settings, Sound, Soundboard, Toast, ToastKind, ViewId } from '@/lib/types'
import { defaultSettings } from '@/lib/types'
import { engine, routeOutput, applyWindowsVirtualMic } from '@/lib/audio'
import { acceleratorEquals, isReserved } from '@/lib/hotkeys'
import { uid } from '@/lib/format'
import { applyAccent } from '@/lib/accents'

export type SettingsTab = 'general' | 'audio' | 'hotkeys' | 'appearance' | 'storage' | 'about'

const BUILT_IN_BOARDS: Soundboard[] = [
  { id: 'sb-gaming', name: 'Gaming' },
  { id: 'sb-memes', name: 'Memes' },
  { id: 'sb-discord', name: 'Discord' },
  { id: 'sb-scp', name: 'SCP' }
]

type MenuState = { x: number; y: number; items: MenuItem[] } | null

type Store = {
  loaded: boolean
  settings: Settings
  soundboards: Soundboard[]
  sounds: Sound[]

  view: ViewId
  filter: FilterId
  search: string
  editingId: string | null
  settingsOpen: boolean
  settingsTab: SettingsTab
  paletteOpen: boolean
  addOpen: boolean
  menu: MenuState
  toasts: Toast[]
  hotkeyStatus: { ok: boolean; registered: string[]; failed: string[] } | null
  setHotkeyStatus: (s: { ok: boolean; registered: string[]; failed: string[] } | null) => void

  init: () => Promise<void>
  persist: () => void
  setSettings: (partial: Partial<Settings>) => void
  setView: (v: ViewId) => void
  setFilter: (f: FilterId) => void
  setSearch: (s: string) => void
  openEditor: (id: string | null) => void
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  setPalette: (open: boolean) => void
  setAddOpen: (open: boolean) => void
  openMenu: (x: number, y: number, items: MenuItem[]) => void
  closeMenu: () => void

  toast: (kind: ToastKind, title: string, message?: string) => void
  dismissToast: (id: number) => void

  addSoundboard: (name?: string) => string
  renameSoundboard: (id: string, name: string) => void
  duplicateSoundboard: (id: string) => void
  deleteSoundboard: (id: string, silent?: boolean) => void
  reorderSoundboards: (ids: string[]) => void

  importPaths: (paths: string[], boardId?: string) => Promise<number>
  updateSound: (id: string, partial: Partial<Sound>) => void
  deleteSound: (id: string) => void
  duplicateSound: (id: string) => void
  toggleFavorite: (id: string) => void
  assignHotkey: (id: string, accel: string | null) => boolean
  syncHotkeys: () => void
  playCountUp: (id: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let toastId = 1
let deviceChangeTimer: ReturnType<typeof setTimeout> | null = null
let deviceChangeRegistered = false

const onDeviceChange = () => {
  if (deviceChangeTimer) clearTimeout(deviceChangeTimer)
  deviceChangeTimer = setTimeout(() => {
    const s = useStore.getState()
    if (s.settings.virtualMic) void routeOutput(s.settings)
  }, 600)
}

export const useStore = create<Store>((set, get) => ({
  loaded: false,
  settings: { ...defaultSettings },
  soundboards: [],
  sounds: [],

  view: 'all',
  filter: 'all',
  search: '',
  editingId: null,
  settingsOpen: false,
  settingsTab: 'general',
  paletteOpen: false,
  addOpen: false,
  menu: null,
  toasts: [],
  hotkeyStatus: null,

  async init() {
    const state = await window.api.loadState()
    const settings: Settings = { ...defaultSettings, ...(state.settings ?? {}) }
    applyAccent(settings.accent)
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion)
    engine.setMasterVolume(settings.masterVolume, settings.muted)
    if (settings.outputDeviceId) void engine.setOutputDevice(settings.outputDeviceId)
    if (settings.virtualMic) {
      if (window.api.platform === 'win32') {
        void applyWindowsVirtualMic(settings)
      } else {
        window.api
          .setVirtualMic({
            enabled: true,
            monitor: settings.virtualMicMonitor,
            includeMic: settings.virtualMicIncludeMic
          })
          .then((res: { ok: boolean }) => {
            if (res.ok) {
              void routeOutput(settings).then((ok) => {
                if (!ok) {
                  get().toast('warning', 'Virtual microphone routing failed', 'Re-enable it in Settings → Audio')
                }
              })
            }
          })
          .catch(() => {})
      }
    }

    if (!deviceChangeRegistered) {
      try {
        const mediaDevices = navigator.mediaDevices
        if (mediaDevices?.addEventListener) {
          mediaDevices.addEventListener('devicechange', onDeviceChange)
          deviceChangeRegistered = true
        }
      } catch {
        /* devicechange unsupported */
      }
    }

    let soundboards: Soundboard[] = (state.soundboards as Soundboard[]) ?? []
    let sounds: Sound[] = (state.sounds as Sound[]) ?? []
    const firstRun = !settings.seeded && soundboards.length === 0 && sounds.length === 0

    if (firstRun) {
      soundboards = [...BUILT_IN_BOARDS]
      const seed = (settings.seedDemo ?? []) as string[]
      const assign: Record<number, string> = { 0: 'sb-gaming', 1: 'sb-gaming', 2: 'sb-gaming', 3: 'sb-memes', 4: 'sb-discord' }
      const made: Sound[] = []
      for (let i = 0; i < seed.length; i++) {
        const fileName = seed[i]
        try {
          const { peaks, duration } = await engine.decode(fileName)
          const base = fileName.replace(/\.wav$/i, '').replace(/_/g, ' ')
          const name = base.charAt(0).toUpperCase() + base.slice(1)
          made.push({
            id: uid(),
            name,
            fileName,
            duration,
            peaks,
            volume: 1,
            loop: false,
            hotkey: i < 3 ? `F${i + 1}` : null,
            favorite: false,
            soundboardId: assign[i] ?? 'sb-gaming',
            playCount: 0,
            lastPlayedAt: null,
            addedAt: Date.now() + i,
            size: 0
          })
        } catch {
          /* skip broken demo */
        }
      }
      sounds = made
      settings.seedDemo = undefined
    }
    settings.seeded = true

    set({ settings, soundboards, sounds, loaded: true })
    get().syncHotkeys()
    get().persist()
  },

  persist() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const { settings, soundboards, sounds } = get()
      window.api.saveState({ settings, soundboards, sounds })
    }, 300)
  },

  setSettings(partial) {
    const settings = { ...get().settings, ...partial }
    set({ settings })
    if (partial.accent) applyAccent(partial.accent)
    if (partial.reduceMotion !== undefined) {
      document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion)
    }
    if (partial.masterVolume !== undefined || partial.muted !== undefined) {
      engine.setMasterVolume(settings.masterVolume, settings.muted)
    }
    if (partial.outputDeviceId !== undefined && !settings.virtualMic) {
      // An explicit null means reset to the system default. Keep this call for
      // null values so a previously selected sink is not left active.
      void engine.setOutputDevice(partial.outputDeviceId)
    }
    if (partial.outputDeviceId !== undefined && settings.virtualMic && settings.virtualMicMonitor && window.api.platform === 'win32') {
      void engine.setMonitorDevice(partial.outputDeviceId)
    }
    if (partial.virtualMic !== undefined || partial.virtualMicMonitor !== undefined || partial.virtualMicIncludeMic !== undefined) {
      if (window.api.platform === 'win32') {
        void applyWindowsVirtualMic(settings).then((ok) => {
          if (!ok && settings.virtualMic && get().settings.virtualMic) {
            // Match Linux behavior: a failed enable must not leave a setting
            // enabled when the VB-Cable device cannot be routed.
            const rolledBack = { ...settings, virtualMic: false }
            useStore.setState((prev) => ({ settings: { ...prev.settings, virtualMic: false } }))
            get().persist()
            void applyWindowsVirtualMic(rolledBack)
            get().toast('warning', 'Virtual microphone not found', 'Install the VB-Cable driver in Settings → Audio first')
          }
        })
      } else {
        window.api
          .setVirtualMic({
            enabled: settings.virtualMic,
            monitor: settings.virtualMicMonitor,
            includeMic: settings.virtualMicIncludeMic
          })
          .then((res: { ok: boolean; error?: string }) => {
            if (!res.ok) {
              useStore.setState((prev) => ({ settings: { ...prev.settings, virtualMic: false } }))
              get().persist()
              get().toast('error', 'Virtual microphone failed', res.error || 'pactl is not available')
            } else {
              void routeOutput(settings).then((ok) => {
                if (!ok && settings.virtualMic) {
                  get().toast('warning', 'Virtual mic not visible yet', 'Retry once the audio device appears')
                }
              })
            }
          })
      }
    }
    if (partial.launchAtLogin !== undefined) {
      window.api.setLoginItem(partial.launchAtLogin)
    }
    if (partial.latencyMode !== undefined) {
      const applied = engine.setLatencyMode(partial.latencyMode)
      if (applied) {
        void routeOutput(settings)
      } else {
        get().toast('info', 'Playback mode applies after sounds stop', 'The current playback finishes first')
      }
    }
    get().persist()
    if (partial.stopAllHotkey !== undefined) get().syncHotkeys()
  },

  setView(v) {
    set({ view: v, filter: 'all' })
  },
  setFilter(f) {
    set({ filter: f })
  },
  setSearch(s) {
    set({ search: s })
  },
  openEditor(id) {
    set({ editingId: id })
  },
  openSettings(tab = 'general') {
    set({ settingsOpen: true, settingsTab: tab, paletteOpen: false })
  },
  closeSettings() {
    set({ settingsOpen: false })
  },
  setPalette(open) {
    set({ paletteOpen: open })
  },
  setAddOpen(open) {
    set({ addOpen: open })
  },
  openMenu(x, y, items) {
    set({ menu: { x, y, items } })
  },
  closeMenu() {
    set({ menu: null })
  },

  setHotkeyStatus(s) {
    set({ hotkeyStatus: s })
  },

  toast(kind, title, message) {
    if (!get().settings.notifications && kind !== 'error') return
    const id = toastId++
    set({ toasts: [...get().toasts.slice(-3), { id, kind, title, message }] })
    setTimeout(() => get().dismissToast(id), 3400)
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },

  addSoundboard(name) {
    const id = uid()
    const finalName = name?.trim() || 'New Soundboard'
    set({ soundboards: [...get().soundboards, { id, name: finalName }], view: id })
    get().persist()
    return id
  },

  renameSoundboard(id, name) {
    set({
      soundboards: get().soundboards.map((b) => (b.id === id ? { ...b, name: name.trim() || b.name } : b))
    })
    get().persist()
  },

  duplicateSoundboard(id) {
    const boards = get().soundboards
    const src = boards.find((b) => b.id === id)
    if (!src) return
    const newId = uid()
    const copies: Sound[] = get()
      .sounds.filter((s) => s.soundboardId === id)
      .map((s) => ({ ...s, id: uid(), soundboardId: newId, hotkey: null, playCount: 0, addedAt: Date.now() }))
    set({
      soundboards: [...boards, { ...src, id: newId, name: `${src.name} Copy` }],
      sounds: [...get().sounds, ...copies]
    })
    get().persist()
    get().toast('success', 'Soundboard created', `${src.name} Copy with ${copies.length} sounds`)
  },

  deleteSoundboard(id, silent = false) {
    const boards = get().soundboards.filter((b) => b.id !== id)
    const allSounds = get().sounds
    const removed = allSounds.filter((s) => s.soundboardId === id)
    const remaining = allSounds.filter((s) => s.soundboardId !== id)
    const remainingFileNames = new Set(remaining.map((s) => s.fileName))
    const filesToDelete = new Set(removed.map((s) => s.fileName).filter((fileName) => !remainingFileNames.has(fileName)))
    for (const s of removed) {
      engine.stop(s.id)
    }
    for (const fileName of filesToDelete) void window.api.deleteSoundFile(fileName)
    set({
      soundboards: boards,
      sounds: remaining,
      view: get().view === id ? 'all' : get().view
    })
    get().persist()
    get().syncHotkeys()
    if (!silent) {
      get().toast('success', 'Soundboard deleted', removed.length ? `${removed.length} sounds removed` : undefined)
    }
  },

  reorderSoundboards(ids) {
    const map = new Map(get().soundboards.map((b) => [b.id, b]))
    const ordered = ids.map((id) => map.get(id)!).filter(Boolean)
    set({ soundboards: ordered })
    get().persist()
  },

  async importPaths(paths, boardId) {
    if (!paths.length) return 0
    const state = get()
    const selectedBoard = state.soundboards.some((b) => b.id === state.view) ? state.view : undefined
    const target = boardId ?? selectedBoard ?? state.soundboards[0]?.id ?? get().addSoundboard('My Sounds')
    const imported = await window.api.importFiles(paths)
    if (!imported.length) {
      get().toast('error', 'Audio file could not be loaded')
      return 0
    }
    const made: Sound[] = []
    for (const f of imported) {
      try {
        const { peaks, duration } = await engine.decode(f.fileName)
        made.push({
          id: f.id,
          name: f.name,
          fileName: f.fileName,
          duration,
          peaks,
          volume: 1,
          loop: false,
          hotkey: null,
          favorite: false,
          soundboardId: target,
          playCount: 0,
          lastPlayedAt: null,
          addedAt: Date.now(),
          size: f.size
        })
      } catch {
        if (!get().sounds.some((s) => s.fileName === f.fileName) && !made.some((s) => s.fileName === f.fileName)) {
          void window.api.deleteSoundFile(f.fileName)
        }
        get().toast('error', 'Audio file could not be loaded', f.name)
      }
    }
    if (made.length) {
      set({ sounds: [...get().sounds, ...made] })
      get().persist()
      get().toast('success', 'Sound imported', made.length === 1 ? made[0].name : `${made.length} sounds added`)
    }
    return made.length
  },

  updateSound(id, partial) {
    set({ sounds: get().sounds.map((s) => (s.id === id ? { ...s, ...partial } : s)) })
    const updated = get().sounds.find((s) => s.id === id)
    if (updated && (partial.volume !== undefined || partial.loop !== undefined)) engine.applyVolume(updated)
    get().persist()
  },

  duplicateSound(id) {
    const sound = get().sounds.find((s) => s.id === id)
    if (!sound) return
    const copy: Sound = {
      ...sound,
      id: uid(),
      name: `${sound.name} Copy`,
      hotkey: null,
      playCount: 0,
      addedAt: Date.now()
    }
    set({ sounds: [...get().sounds, copy] })
    get().persist()
    get().toast('success', 'Sound duplicated', copy.name)
  },

  deleteSound(id) {
    const sound = get().sounds.find((s) => s.id === id)
    if (!sound) return
    const remaining = get().sounds.filter((s) => s.id !== id)
    engine.stop(id)
    if (!remaining.some((s) => s.fileName === sound.fileName)) void window.api.deleteSoundFile(sound.fileName)
    set({
      sounds: remaining,
      editingId: get().editingId === id ? null : get().editingId
    })
    get().persist()
    get().syncHotkeys()
    get().toast('success', 'Sound deleted', sound.name)
  },

  toggleFavorite(id) {
    const s = get().sounds.find((x) => x.id === id)
    if (!s) return
    get().updateSound(id, { favorite: !s.favorite })
  },

  assignHotkey(id, accel) {
    if (accel && isReserved(accel)) {
      get().toast('warning', 'Hotkey already in use', 'This shortcut is reserved by the system or app')
      return false
    }
    if (accel) {
      if (acceleratorEquals(accel, get().settings.stopAllHotkey)) {
        get().toast('warning', 'Hotkey already in use', 'Assigned to Stop All')
        return false
      }
      const conflict = get().sounds.find((s) => s.id !== id && acceleratorEquals(s.hotkey, accel))
      if (conflict) {
        get().toast('warning', 'Hotkey already in use', `Assigned to ${conflict.name}`)
        return false
      }
    }
    get().updateSound(id, { hotkey: accel })
    get().syncHotkeys()
    if (accel) get().toast('success', 'Hotkey assigned', accel.replace(/\+/g, ' + '))
    return true
  },

  syncHotkeys() {
    const { sounds, settings } = get()
    const map: Record<string, string> = {}
    for (const s of sounds) {
      if (s.hotkey) map[s.id] = s.hotkey
    }
    window.api.syncHotkeys({ sound: map, stopAll: settings.stopAllHotkey })
  },

  playCountUp(id) {
    const s = get().sounds.find((x) => x.id === id)
    if (!s) return
    get().updateSound(id, { playCount: s.playCount + 1, lastPlayedAt: Date.now() })
  }
}))

export function currentBoardName(view: ViewId, soundboards: Soundboard[]): string {
  if (view === 'all') return 'All Sounds'
  if (view === 'favorites') return 'Favorites'
  if (view === 'recent') return 'Recently Played'
  return soundboards.find((b) => b.id === view)?.name ?? 'Sounds'
}

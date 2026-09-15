import { contextBridge, ipcRenderer, webUtils } from 'electron'

export type ImportedFile = { id: string; fileName: string; name: string; size: number }
export type StorageStats = { bytes: number; count: number; dir: string }
export type AppInfo = { version: string; electron: string; chrome: string; node: string }

const api = {
  platform: process.platform,
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state: unknown) => ipcRenderer.send('state:save', state),
  openFiles: () => ipcRenderer.invoke('dialog:open-files'),
  importFiles: (paths: string[]) => ipcRenderer.invoke('files:import', paths),
  deleteSoundFile: (fileName: string) => ipcRenderer.invoke('sound:delete-file', fileName),
  soundExists: (fileName: string) => ipcRenderer.invoke('sound:exists', fileName),
  storageStats: () => ipcRenderer.invoke('storage:stats'),
  revealSound: (fileName: string) => ipcRenderer.send('sound:reveal', fileName),
  openDataFolder: () => ipcRenderer.send('data:open'),
  syncHotkeys: (payload: { sound: Record<string, string>; stopAll: string | null }) =>
    ipcRenderer.send('hotkeys:sync', payload),
  suspendHotkeys: () => ipcRenderer.send('hotkeys:suspend'),
  resumeHotkeys: () => ipcRenderer.send('hotkeys:resume'),
  appInfo: () => ipcRenderer.invoke('app:info'),
  setLoginItem: (open: boolean) => ipcRenderer.send('login:set', open),
  setVirtualMic: (opts: { enabled: boolean; monitor: boolean; includeMic: boolean }) =>
    ipcRenderer.invoke('virtualmic:set', opts),
  installVBCable: () => ipcRenderer.invoke('vbcable:install'),
  hotkeysDiagnose: () => ipcRenderer.invoke('hotkeys:diagnose'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  pathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return null
    }
  },
  onTriggerSound: (cb: (id: string) => void) => {
    ipcRenderer.on('trigger-sound', (_e, id: string) => cb(id))
  },
  onGlobalShortcutStatus: (cb: (status: { ok: boolean; registered: string[]; failed: string[] }) => void) => {
    ipcRenderer.on('global-shortcut-status', (_e, status) => cb(status))
  },
  onStopAll: (cb: () => void) => {
    ipcRenderer.on('trigger-stop-all', () => cb())
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api

import { app, BrowserWindow, ipcMain, protocol, dialog, globalShortcut, net, shell, session, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import crypto from 'node:crypto'
import { execFile, spawn } from 'node:child_process'

const SOUND_SCHEME = 'sound'

protocol.registerSchemesAsPrivileged([
  { scheme: SOUND_SCHEME, privileges: { supportFetchAPI: true, stream: true, bypassCSP: false } }
])

type Library = {
  version: number
  settings: Record<string, unknown>
  soundboards: unknown[]
  sounds: unknown[]
}

const defaultLibrary: Library = { version: 1, settings: {}, soundboards: [], sounds: [] }

let library: Library = JSON.parse(JSON.stringify(defaultLibrary))
let saveTimer: NodeJS.Timeout | null = null

let win: BrowserWindow | null = null
let hotkeyMap = new Map<string, string>()
let stopAllHotkey: string | null = null
let hotkeysSuspended = false
let lastStatusSignature: string | null = null
let statusSent = false

const soundsDir = () => path.join(app.getPath('userData'), 'sounds')
const libraryFile = () => path.join(app.getPath('userData'), 'library.json')
const windowFile = () => path.join(app.getPath('userData'), 'window-state.json')

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.webm': 'audio/webm'
}

function uniqueFileName(original: string): string {
  const ext = path.extname(original).toLowerCase()
  const base = path.basename(original, ext).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'sound'
  let name = `${base}${ext}`
  let i = 1
  while (fs.existsSync(path.join(soundsDir(), name))) {
    name = `${base}_${i++}${ext}`
  }
  return name
}

function registerHotkeys() {
  globalShortcut.unregisterAll()
  if (hotkeysSuspended) {
    statusSent = false
    return
  }
  const registered: string[] = []
  const failed: string[] = []
  for (const [accel, id] of hotkeyMap) {
    try {
      if (globalShortcut.register(accel, () => win?.webContents.send('trigger-sound', id))) registered.push(accel)
      else failed.push(accel)
    } catch {
      failed.push(accel)
    }
  }
  if (stopAllHotkey) {
    try {
      if (globalShortcut.register(stopAllHotkey, () => win?.webContents.send('trigger-stop-all'))) registered.push(stopAllHotkey)
      else failed.push(stopAllHotkey)
    } catch {
      failed.push(stopAllHotkey)
    }
  }
  const status = { ok: failed.length === 0, registered, failed }
  const statusSignature = JSON.stringify(status)
  if (!statusSent || lastStatusSignature !== statusSignature) {
    lastStatusSignature = statusSignature
    statusSent = true
    win?.webContents.send('global-shortcut-status', status)
  }
}

const VIRTUAL_SINK_NAME = 'echodeck_virtual_mic'
const VIRTUAL_SINK_LABEL = 'EchoDeck Virtual Mic'
const SOUNDS_SINK_NAME = 'echodeck_sounds'
const SOUNDS_SINK_LABEL = 'EchoDeck Sounds'
const virtualModules: { sounds?: string; mic?: string; route?: string; micLoop?: string; speakerLoop?: string } = {}

function execPactl(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('pactl', args, { timeout: 6000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(String(stderr || err.message)))
      else resolve(String(stdout))
    })
  })
}

async function listModules(): Promise<{ id: string; args: string }[]> {
  try {
    const out = await execPactl(['list', 'short', 'modules'])
    return out
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const p = l.split('\t')
        return { id: p[0], args: p.slice(2).join(' ') }
      })
  } catch {
    return []
  }
}

async function findModuleLine(predicate: (args: string) => boolean): Promise<string | null> {
  try {
    const out = await execPactl(['list', 'short', 'modules'])
    for (const line of out.split('\n')) {
      const parts = line.split('\t')
      if (parts.length >= 3 && predicate(parts.slice(2).join(' '))) return parts[0]
    }
    return null
  } catch {
    return null
  }
}

async function ensureSink(name: string, label: string): Promise<string | undefined> {
  const existing = await findModuleLine((a) => a.includes(`sink_name=${name}`))
  if (existing) return existing
  const out = await execPactl([
    'load-module',
    'module-null-sink',
    `sink_name=${name}`,
    `sink_properties="device.description='${label}'"`
  ])
  return out.trim()
}

async function cleanupLegacyModules(): Promise<boolean> {
  const mods = await listModules()
  const legacy = mods.filter(
    (m) => /sink_name=echodeck_(virtual_mic|sounds)/.test(m.args) && m.args.includes('device.description="')
  )
  if (!legacy.length) return false
  for (const m of mods.filter((x) => x.args.includes('echodeck_'))) {
    await execPactl(['unload-module', m.id]).catch(() => {})
  }
  virtualModules.sounds = undefined
  virtualModules.mic = undefined
  virtualModules.route = undefined
  virtualModules.micLoop = undefined
  virtualModules.speakerLoop = undefined
  return true
}

async function enableVirtualMic(opts: { monitor: boolean; includeMic: boolean }): Promise<void> {
  await cleanupLegacyModules()
  virtualModules.sounds = virtualModules.sounds ?? (await ensureSink(SOUNDS_SINK_NAME, SOUNDS_SINK_LABEL))
  virtualModules.mic = virtualModules.mic ?? (await ensureSink(VIRTUAL_SINK_NAME, VIRTUAL_SINK_LABEL))

  if (!virtualModules.route) {
    virtualModules.route =
      (await findModuleLine((a) => a.includes(`source=${SOUNDS_SINK_NAME}.monitor`) && a.includes(`sink=${VIRTUAL_SINK_NAME}`))) ??
      (
        await execPactl([
          'load-module',
          'module-loopback',
          `source=${SOUNDS_SINK_NAME}.monitor`,
          `sink=${VIRTUAL_SINK_NAME}`,
          'latency_msec=40'
        ])
      ).trim()
  }

  if (opts.includeMic && !virtualModules.micLoop) {
    virtualModules.micLoop =
      (await findModuleLine((a) => a.includes(`sink=${VIRTUAL_SINK_NAME}`) && !a.includes(SOUNDS_SINK_NAME))) ??
      (
        await execPactl(['load-module', 'module-loopback', `sink=${VIRTUAL_SINK_NAME}`, 'latency_msec=20'])
      ).trim()
  } else if (!opts.includeMic && virtualModules.micLoop) {
    await execPactl(['unload-module', virtualModules.micLoop]).catch(() => {})
    virtualModules.micLoop = undefined
  }

  if (opts.monitor && !virtualModules.speakerLoop) {
    virtualModules.speakerLoop =
      (await findModuleLine((a) => a.includes(`source=${SOUNDS_SINK_NAME}.monitor`) && !a.includes(`sink=${VIRTUAL_SINK_NAME}`))) ??
      undefined
    if (!virtualModules.speakerLoop) {
      try {
        const out = await execPactl([
          'load-module',
          'module-loopback',
          `source=${SOUNDS_SINK_NAME}.monitor`,
          'latency_msec=60'
        ])
        virtualModules.speakerLoop = out.trim()
      } catch {
        /* local monitoring is optional */
      }
    }
  } else if (!opts.monitor && virtualModules.speakerLoop) {
    await execPactl(['unload-module', virtualModules.speakerLoop]).catch(() => {})
    virtualModules.speakerLoop = undefined
  }
}

async function disableVirtualMic(): Promise<void> {
  const cleanup: (string | undefined)[] = [
    virtualModules.speakerLoop ?? ((await findModuleLine((a) => a.includes(`source=${SOUNDS_SINK_NAME}.monitor`) && !a.includes(`sink=${VIRTUAL_SINK_NAME}`))) ?? undefined),
    virtualModules.micLoop ?? ((await findModuleLine((a) => a.includes(`sink=${VIRTUAL_SINK_NAME}`) && !a.includes(SOUNDS_SINK_NAME))) ?? undefined),
    virtualModules.route ?? ((await findModuleLine((a) => a.includes(`source=${SOUNDS_SINK_NAME}.monitor`) && a.includes(`sink=${VIRTUAL_SINK_NAME}`))) ?? undefined),
    virtualModules.mic ?? ((await findModuleLine((a) => a.includes(`sink_name=${VIRTUAL_SINK_NAME}`))) ?? undefined),
    virtualModules.sounds ?? ((await findModuleLine((a) => a.includes(`sink_name=${SOUNDS_SINK_NAME}`))) ?? undefined)
  ]
  for (const id of cleanup) {
    if (id) await execPactl(['unload-module', id]).catch(() => {})
  }
  virtualModules.sounds = undefined
  virtualModules.mic = undefined
  virtualModules.route = undefined
  virtualModules.micLoop = undefined
  virtualModules.speakerLoop = undefined
}

function validBounds(b: unknown) {
  if (!b || typeof b !== 'object') return false
  const r = b as { x: number; y: number; width: number; height: number }
  if (r.width < 500 || r.height < 400) return false
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return (
      r.x < a.x + a.width - 40 &&
      r.x + r.width > a.x + 40 &&
      r.y < a.y + a.height - 40 &&
      r.y + r.height > a.y + 40
    )
  })
}

function createWindow() {
  let bounds = { width: 1280, height: 820 }
  let maximized = false
  try {
    const saved = JSON.parse(fs.readFileSync(windowFile(), 'utf8'))
    if (validBounds(saved.bounds)) bounds = saved.bounds
    maximized = !!saved.maximized
  } catch {
    /* first run */
  }

  win = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0b0c0e',
    title: 'EchoDeck',
    autoHideMenuBar: true,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(app.getAppPath(), 'resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })

  if (maximized) win.maximize()

  win.on('ready-to-show', () => win?.show())


  const saveBounds = () => {
    if (!win || win.isDestroyed()) return
    try {
      fs.writeFileSync(windowFile(), JSON.stringify({ bounds: win.getNormalBounds(), maximized: win.isMaximized() }))
    } catch {
      /* ignore */
    }
  }
  win.on('resized', saveBounds)
  win.on('moved', saveBounds)
  win.on('maximize', saveBounds)
  win.on('unmaximize', saveBounds)
  win.on('close', saveBounds)

  win.on('closed', () => (win = null))

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

const noSingleton = process.argv.includes('--no-singleton')
const gotLock = noSingleton || app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  // Must be configured before Electron initializes Chromium. This enables the
  // xdg-desktop-portal GlobalShortcuts implementation on native Wayland.
  try {
    app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')
  } catch {
    /* ignore */
  }

  app.whenReady().then(async () => {
    await fsp.mkdir(soundsDir(), { recursive: true })

    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'))
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media')

    protocol.handle(SOUND_SCHEME, async (request) => {
      try {
        const url = new URL(request.url)
        const name = path.basename(decodeURIComponent(url.pathname))
        const file = path.join(soundsDir(), name)
        if (!file.startsWith(soundsDir())) return new Response(null, { status: 403 })
        const data = await fsp.readFile(file)
        return new Response(data as unknown as BodyInit, {
          headers: { 'content-type': MIME[path.extname(name)] ?? 'application/octet-stream' }
        })
      } catch {
        return new Response(null, { status: 404 })
      }
    })

    ipcMain.handle('state:load', async () => {
      try {
        const raw = await fsp.readFile(libraryFile(), 'utf8')
        const parsed = JSON.parse(raw)
        library = { ...JSON.parse(JSON.stringify(defaultLibrary)), ...parsed }
      } catch {
        library = JSON.parse(JSON.stringify(defaultLibrary))
        const demoDir = app.isPackaged
          ? path.join(process.resourcesPath, 'demo')
          : path.join(app.getAppPath(), 'resources/demo')
        try {
          const demos = (await fsp.readdir(demoDir)).filter((f) => f.endsWith('.wav')).sort()
          if (demos.length) {
            const ids: string[] = []
            for (const d of demos) {
              const fileName = uniqueFileName(d)
              await fsp.copyFile(path.join(demoDir, d), path.join(soundsDir(), fileName))
              ids.push(fileName)
            }
            library.settings.seedDemo = ids
          }
        } catch {
          /* no demo available */
        }
      }
      return library
    })

    ipcMain.on('state:save', (_e, state: Partial<Library>) => {
      library = { ...library, ...state }
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        fsp.writeFile(libraryFile(), JSON.stringify(library)).catch(() => {})
      }, 250)
    })

    ipcMain.handle('dialog:open-files', async () => {
      if (!win) return null
      const res = await dialog.showOpenDialog(win, {
        title: 'Import audio files',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'webm'] }]
      })
      return res.canceled ? null : res.filePaths
    })

    ipcMain.handle('files:import', async (_e, paths: string[]) => {
      const out: { id: string; fileName: string; name: string; size: number }[] = []
      for (const p of paths) {
        try {
          const ext = path.extname(p).toLowerCase()
          if (!MIME[ext]) continue
          const fileName = uniqueFileName(path.basename(p))
          await fsp.copyFile(p, path.join(soundsDir(), fileName))
          const st = await fsp.stat(path.join(soundsDir(), fileName))
          out.push({ id: crypto.randomUUID(), fileName, name: path.basename(p, ext), size: st.size })
        } catch {
          /* skip unreadable file */
        }
      }
      return out
    })

    ipcMain.handle('sound:delete-file', async (_e, fileName: string) => {
      try {
        await fsp.unlink(path.join(soundsDir(), path.basename(fileName)))
      } catch {
        /* already gone */
      }
    })

    ipcMain.handle('sound:exists', async (_e, fileName: string) => {
      try {
        await fsp.access(path.join(soundsDir(), path.basename(fileName)))
        return true
      } catch {
        return false
      }
    })

    ipcMain.handle('storage:stats', async () => {
      let bytes = 0
      let count = 0
      try {
        for (const f of await fsp.readdir(soundsDir())) {
          const st = await fsp.stat(path.join(soundsDir(), f))
          bytes += st.size
          count++
        }
      } catch {
        /* ignore */
      }
      return { bytes, count, dir: soundsDir() }
    })

    ipcMain.on('sound:reveal', (_e, fileName: string) => shell.showItemInFolder(path.join(soundsDir(), path.basename(fileName))))
    ipcMain.on('data:open', () => shell.openPath(soundsDir()))

    ipcMain.on('hotkeys:suspend', () => {
      hotkeysSuspended = true
      globalShortcut.unregisterAll()
    })

    ipcMain.on('hotkeys:resume', () => {
      hotkeysSuspended = false
      registerHotkeys()
    })

    ipcMain.on('hotkeys:sync', (_e, payload: { sound: Record<string, string>; stopAll: string | null }) => {
      hotkeyMap = new Map(Object.entries(payload.sound ?? {}).map(([id, accel]) => [accel, id]))
      stopAllHotkey = payload.stopAll
      registerHotkeys()
    })

    let vmQueue: Promise<unknown> = Promise.resolve()
    ipcMain.handle('virtualmic:set', (_e, opts: { enabled: boolean; monitor: boolean; includeMic: boolean }) => {
      if (process.platform === 'win32') {
        return Promise.resolve({ ok: true })
      }
      const task = vmQueue.then(async () => {
        try {
          if (opts.enabled) {
            await enableVirtualMic(opts)
          } else {
            await disableVirtualMic()
          }
          return { ok: true }
        } catch (e) {
          return { ok: false, error: (e as Error).message }
        }
      })
      vmQueue = task.catch(() => {})
      return task
    })

    const VBCABLE_URLS = [
      'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack46.zip',
      'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip',
      'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip'
    ]
    ipcMain.handle('vbcable:install', async () => {
      const tmp = path.join(app.getPath('temp'), 'echodeck-vbcable')
      for (const url of VBCABLE_URLS) {
        try {
          const res = await net.fetch(url, { bypassCustomProtocolHandlers: true })
          if (!res.ok) continue
          const buf = Buffer.from(await res.arrayBuffer())
          if (buf.length < 100_000) continue
          await fsp.mkdir(tmp, { recursive: true })
          const zip = path.join(tmp, 'vbcable.zip')
          await fsp.writeFile(zip, buf)
          await new Promise<void>((resolve, reject) => {
            const ps = spawn(
              'powershell.exe',
              ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${tmp}\\driver' -Force`],
              { timeout: 90_000 }
            )
            ps.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`expand failed (${code})`))))
            ps.on('error', reject)
          })
          const findInstaller = async (dir: string): Promise<string | null> => {
            let found: string | null = null
            const walk = async (d: string) => {
              for (const f of await fsp.readdir(d, { withFileTypes: true })) {
                const full = path.join(d, f.name)
                if (f.isDirectory()) await walk(full)
                else if (/^VBCABLE_Setup_x64.*\.exe$/i.test(f.name)) found = full
              }
            }
            await walk(dir)
            return found
          }
          const installer = await findInstaller(path.join(tmp, 'driver'))
          if (!installer) continue
          await new Promise<void>((resolve, reject) => {
            const ps = spawn(
              'powershell.exe',
              ['-NoProfile', '-Command', `Start-Process -FilePath '${installer}' -Verb RunAs`],
              { timeout: 120_000 }
            )
            ps.on('exit', () => resolve())
            ps.on('error', reject)
          })
          return { ok: true }
        } catch {
          continue
        }
      }
      return { ok: false }
    })

    ipcMain.on('open-external', (_e, url: string) => {
      if (/^https:\/\//.test(url)) shell.openExternal(url)
    })

    ipcMain.handle('hotkeys:diagnose', async () => {
      const run = (cmd: string, args: string[]): Promise<string | null> =>
        new Promise((resolve) => {
          execFile(cmd, args, { timeout: 5000 }, (err, stdout) => resolve(err ? null : String(stdout).trim()))
        })
      const sessionType = process.env.XDG_SESSION_TYPE ?? 'unknown'
      const desktop = process.env.XDG_CURRENT_DESKTOP ?? process.env.DESKTOP_SESSION ?? 'unknown'
      const plasmaRaw = await run('plasmashell', ['--version'])
      const plasmaVersion = plasmaRaw ? plasmaRaw.replace(/^plasmashell\s*/i, '') : null
      const listNames = await run('gdbus', [
        'call', '--session', '--dest', 'org.freedesktop.DBus', '--object-path', '/org/freedesktop/DBus',
        '--method', 'org.freedesktop.DBus.ListNames'
      ])
      const portalRunning = listNames === null ? null : /xdg[-_]desktop[-_]portal/.test(listNames)
      const introspect = await run('gdbus', [
        'introspect', '--session', '--dest', 'org.freedesktop.portal.Desktop',
        '--object-path', '/org/freedesktop/portal/desktop'
      ])
      const globalShortcuts = introspect === null ? null : /GlobalShortcuts/.test(introspect)
      return { sessionType, desktop, plasmaVersion, portalRunning, globalShortcuts }
    })

    ipcMain.on('login:set', (_e, open: boolean) => {
      try {
        app.setLoginItemSettings({ openAtLogin: open })
      } catch {
        /* not supported on this platform */
      }
    })

    ipcMain.handle('app:info', () => ({
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    }))

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    void disableVirtualMic()
  })
}

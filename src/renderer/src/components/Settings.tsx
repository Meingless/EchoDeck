import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useStore, type SettingsTab } from '@/store/store'
import { ACCENTS } from '@/lib/accents'
import { HotkeyCapture } from './HotkeyCapture'
import { LogoMark } from './TopBar'
import { fmtSize } from '@/lib/format'
import { acceleratorEquals, isReserved } from '@/lib/hotkeys'
import { listOutputDevices } from '@/lib/audio'
import {
  Settings2, Volume2, Keyboard, Palette, HardDrive, Info, Volume2 as VolIcon
} from 'lucide-react'
import type { AccentId, LatencyMode } from '@/lib/types'

const TABS: { id: SettingsTab; label: string; icon: typeof Settings2 }[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'audio', label: 'Audio', icon: Volume2 },
  { id: 'hotkeys', label: 'Hotkeys', icon: Keyboard },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'about', label: 'About', icon: Info }
]

function Group({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="settings-group">
      <div className="setting-group">
        <div className="eyebrow" style={{ padding: '0 12px 8px' }}>
          {title}
        </div>
        {desc && <div style={{ padding: '0 12px 10px', fontSize: 'var(--fs-md)', color: 'var(--text-tertiary)', marginTop: -6 }}>{desc}</div>}
        {children}
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
  disabled
}: {
  label: string
  desc?: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="setting-row" style={{ opacity: disabled ? 0.5 : 1 }}>
      <div>
        <div className="setting-label">{label}</div>
        {desc && <div className="setting-desc">{desc}</div>}
      </div>
      <button
        className={`switch${value ? ' on' : ''}`}
        onClick={() => !disabled && onChange(!value)}
        role="switch"
        aria-checked={value}
        aria-label={label}
      />
    </div>
  )
}

function GeneralTab() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  return (
    <>
      <Group title="Playback">
        <ToggleRow
          label="Stop other sounds when playing"
          desc="Only one sound plays at a time"
          value={settings.stopOthersOnPlay}
          onChange={(v) => setSettings({ stopOthersOnPlay: v })}
        />
        <ToggleRow
          label="Floating playback bar"
          desc="Show active sounds in a bar at the bottom"
          value={settings.showPlaybackBar}
          onChange={(v) => setSettings({ showPlaybackBar: v })}
        />
        <ToggleRow
          label="Notifications"
          desc="Toast notifications for imports and assignments"
          value={settings.notifications}
          onChange={(v) => setSettings({ notifications: v })}
        />
      </Group>
      <Group title="System">
        <ToggleRow
          label="Launch at login"
          desc="Start EchoDeck when you log in (where supported)"
          value={settings.launchAtLogin}
          onChange={(v) => setSettings({ launchAtLogin: v })}
        />
      </Group>
    </>
  )
}

function AudioTab() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const [devices, setDevices] = useState<{ deviceId: string; label: string; isDefault: boolean }[]>([])
  const platform = window.api.platform
  const isLinux = platform === 'linux'
  const isWin = platform === 'win32'
  const cableFound = devices.some((d) => /CABLE Input/i.test(d.label))
  const [installState, setInstallState] = useState<'idle' | 'busy'>('idle')

  const rescan = () => {
    void listOutputDevices().then(setDevices)
  }

  useEffect(() => {
    rescan()
    let timer: ReturnType<typeof setTimeout> | null = null
    const onDeviceChange = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(rescan, 500)
    }
    try {
      navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
    } catch {
      /* devicechange unsupported */
    }
    return () => {
      if (timer) clearTimeout(timer)
      try {
        navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
      } catch {
        /* devicechange unsupported */
      }
    }
  }, [])

  const installVBCable = async () => {
    setInstallState('busy')
    const res = await window.api.installVBCable()
    setInstallState('idle')
    if (res.ok) {
      useStore.getState().toast('info', 'Driver installer launched', 'Allow the Windows prompt and click Install. Then press Re-check here.')
    } else {
      window.api.openExternal('https://vb-audio.com/Cable/')
      useStore.getState().toast('warning', 'Opening the VB-Cable website', 'Download and run VBCABLE_Setup_x64 there, then press Re-check')
    }
  }

  return (
    <>
      <Group title="Output">
        <div className="setting-row">
          <div>
            <div className="setting-label">Output device</div>
            <div className="setting-desc">Where sounds are played</div>
          </div>
          <div className="setting-control" style={{ width: 230 }}>
            <select
              className="native-select"
              value={settings.outputDeviceId ?? ''}
              onChange={(e) => setSettings({ outputDeviceId: e.target.value || null })}
              aria-label="Output device"
            >
              <option value="">System Default</option>
              {devices
                .filter((d) => !d.isDefault && d.deviceId !== 'communications' && !d.label.startsWith('EchoDeck'))
                .map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="setting-row">
          <div style={{ flex: 1 }}>
            <div className="setting-label">Master volume</div>
            <div className="volume-large-row" style={{ padding: '8px 0 0' }}>
              <VolIcon size={16} style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="range"
                className="slider"
                min={0}
                max={1}
                step={0.01}
                value={settings.masterVolume}
                style={{ '--fill': `${Math.round(settings.masterVolume * 100)}%` } as React.CSSProperties}
                onChange={(e) => setSettings({ masterVolume: Number(e.target.value), muted: false })}
                aria-label="Master volume"
              />
              <span className="volume-pct">{Math.round(settings.masterVolume * 100)}%</span>
            </div>
          </div>
        </div>
      </Group>
      {isLinux && (
        <>
          <Group
            title="Virtual microphone"
            desc="Route soundboard audio into a virtual mic for games and voice chat"
          >
            <ToggleRow
              label="Play into virtual microphone"
              desc="Sounds go to 'EchoDeck Virtual Mic' instead of your speakers"
              value={settings.virtualMic}
              onChange={(v) => setSettings({ virtualMic: v })}
            />
            <ToggleRow
              label="Include my real microphone"
              desc="Your normal voice is mixed into the virtual mic — talk normally when you're not playing sounds"
              value={settings.virtualMicIncludeMic}
              onChange={(v) => setSettings({ virtualMicIncludeMic: v })}
            />
            <ToggleRow
              label="Also play on speakers"
              desc="Off by default: sounds go only to the mic channel. Enable to hear them yourself too"
              value={settings.virtualMicMonitor}
              onChange={(v) => setSettings({ virtualMicMonitor: v })}
            />
            <div className="setting-row">
              <div>
                <div className="setting-label">How to use</div>
                <div className="setting-desc" style={{ lineHeight: 1.6 }}>
                  In your game or Discord, set the <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>input/microphone</strong> to
                  {' '}“Monitor of EchoDeck Virtual Mic” — then leave it there permanently. Your voice always passes through; sounds are mixed in
                  only while they play.
                </div>
              </div>
            </div>
          </Group>
        </>
      )}

      {isWin && (
        <Group
          title="Virtual microphone"
          desc="Plays soundboard audio into a virtual mic for games and voice chat, mixed with your real voice"
        >
          {cableFound ? (
            <>
              <ToggleRow
                label="Play into virtual microphone"
                desc="Sounds go to 'CABLE Input' (VB-Cable) instead of your speakers"
                value={settings.virtualMic}
                onChange={(v) => setSettings({ virtualMic: v })}
              />
              <ToggleRow
                label="Include my real microphone"
                desc="Your normal voice is mixed into the virtual mic — talk normally when you're not playing sounds"
                value={settings.virtualMicIncludeMic}
                onChange={(v) => setSettings({ virtualMicIncludeMic: v })}
              />
              <ToggleRow
                label="Also play on speakers"
                desc="Off by default: sounds go only to the mic channel. Enable to hear them yourself too"
                value={settings.virtualMicMonitor}
                onChange={(v) => setSettings({ virtualMicMonitor: v })}
              />
              <div className="setting-row">
                <div>
                  <div className="setting-label">How to use</div>
                  <div className="setting-desc" style={{ lineHeight: 1.6 }}>
                    In your game or Discord, set the <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>input/microphone</strong> to
                    {' '}“CABLE Output (VB-Audio Virtual Cable)” — then leave it there permanently. Your voice always passes through; sounds are
                    mixed in only while they play.
                  </div>
                </div>
                <button className="btn" onClick={rescan}>
                  Re-check
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Driver required</div>
                  <div className="setting-desc" style={{ lineHeight: 1.6 }}>
                    Windows needs a free virtual audio driver (VB-Cable by VB-Audio) to expose a
                    microphone that carries the sounds. This downloads the official installer and
                    launches it — allow the Windows prompt and click Install. A restart of EchoDeck
                    afterwards is recommended.
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => void installVBCable()} disabled={installState === 'busy'}>
                  {installState === 'busy' ? 'Downloading…' : 'Install VB-Cable'}
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Already installed it?</div>
                  <div className="setting-desc">Scan audio devices again to detect the driver</div>
                </div>
                <button className="btn" onClick={rescan}>
                  Re-check
                </button>
              </div>
            </>
          )}
        </Group>
      )}

      <Group title="Playback mode" desc="Balances latency against CPU usage">
        <div className="setting-row">
          <div className="setting-control" style={{ width: '100%' }}>
            <div className="segmented" style={{ width: '100%' }}>
              {(
                [
                  { id: 'low', label: 'Low latency' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'efficient', label: 'Power efficient' }
                ] as { id: LatencyMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  className={settings.latencyMode === m.id ? 'on' : ''}
                  style={{ flex: 1 }}
                  onClick={() => setSettings({ latencyMode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Group>
    </>
  )
}

type HotkeyDiag = {
  sessionType: string
  desktop: string
  plasmaVersion: string | null
  portalRunning: boolean | null
  globalShortcuts: boolean | null
}

function HotkeysTab() {
  const status = useStore((s) => s.hotkeyStatus)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const sounds = useStore((s) => s.sounds)
  const assignHotkey = useStore((s) => s.assignHotkey)
  const syncHotkeys = useStore((s) => s.syncHotkeys)
  const updateSound = useStore((s) => s.updateSound)
  const withHotkeys = sounds.filter((s) => s.hotkey)
  const isLinux = window.api.platform === 'linux'
  const [diag, setDiag] = useState<HotkeyDiag | null>(null)

  useEffect(() => {
    if (!isLinux) return
    let cancelled = false
    void window.api.hotkeysDiagnose().then((d) => {
      if (!cancelled) setDiag(d)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isLinux])

  const diagAdvice = (): string | null => {
    if (!diag) return null
    if (diag.sessionType && diag.sessionType !== 'wayland') {
      return 'You are on X11 — global shortcuts work natively. If they still fail, another application is holding these keys.'
    }
    if (diag.globalShortcuts === false) {
      return 'Your session portal does NOT support global shortcuts. Background hotkeys are unavailable in this session — upgrade to KDE Plasma 6, or switch to an X11 session at the login screen. In-app hotkeys keep working.'
    }
    if (diag.globalShortcuts === true) {
      return 'The portal supports global shortcuts. Approve them in System Settings → Global Shortcuts → EchoDeck, then press Re-register.'
    }
    return null
  }

  const setStopAll = (accel: string | null) => {
    if (accel) {
      if (isReserved(accel)) {
        useStore.getState().toast('warning', 'Hotkey already in use', 'This shortcut is reserved by the system or app')
        return false
      }
      const conflict = sounds.find((s) => acceleratorEquals(s.hotkey, accel))
      if (conflict) {
        useStore.getState().toast('warning', 'Hotkey already in use', `Assigned to ${conflict.name}`)
        return false
      }
    }
    setSettings({ stopAllHotkey: accel })
    syncHotkeys()
    return true
  }

  return (
    <>
      <Group title="Global" desc="Triggered system-wide, even when EchoDeck is in the background">
        <div className="setting-row">
          <div>
            <div className="setting-label">Stop all sounds</div>
            <div className="setting-desc">Silences every playing sound at once</div>
          </div>
          <HotkeyCapture value={settings.stopAllHotkey} onChange={setStopAll} />
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Re-register global shortcuts</div>
            <div className="setting-desc">
              On Wayland, your desktop may ask to approve the shortcuts. You can also manage them in System Settings → Global Shortcuts → EchoDeck.
            </div>
          </div>
          <button
            className="btn"
            onClick={() => {
              syncHotkeys()
              useStore.getState().toast('info', 'Global shortcuts re-registered', 'If your desktop shows an approval dialog, allow the shortcuts.')
            }}
          >
            Re-register
          </button>
        </div>
      </Group>
      {isLinux && (
        <Group title="Environment check">
          <div className="kv-row">
            <span>Session</span>
            <span>{diag ? `${diag.sessionType} · ${diag.desktop}` : 'Checking…'}</span>
          </div>
          <div className="kv-row">
            <span>Portal service</span>
            <span>{diag ? (diag.portalRunning === null ? 'unknown (gdbus missing)' : diag.portalRunning ? 'running' : 'not running') : '…'}</span>
          </div>
          <div className="kv-row">
            <span>GlobalShortcuts support</span>
            <span style={{ color: diag?.globalShortcuts === false ? 'var(--warning)' : undefined }}>
              {diag ? (diag.globalShortcuts === null ? 'unknown (gdbus missing)' : diag.globalShortcuts ? 'available' : 'not available') : '…'}
            </span>
          </div>
          <div className="kv-row">
            <span>KDE Plasma</span>
            <span>{diag ? (diag.plasmaVersion ?? 'not detected') : '…'}</span>
          </div>
          {diagAdvice() && (
            <div className="setting-row" style={{ borderTop: 'none' }}>
              <div className="setting-desc" style={{ lineHeight: 1.6 }}>
                {diagAdvice()}
              </div>
            </div>
          )}
        </Group>
      )}
      {status && (status.registered.length > 0 || status.failed.length > 0) && (
        <Group title="Registration status">
          <div className="setting-row">
            <div>
              <div className="setting-label" style={{ color: status.failed.length === 0 ? 'var(--success)' : 'var(--warning)' }}>
                {status.failed.length === 0
                  ? `All registered (system-wide) — ${status.registered.join(', ')}`
                  : `Registered: ${status.registered.join(', ') || 'none'}`}
              </div>
              {status.failed.length > 0 && (
                <div className="setting-desc">
                  Failed: {status.failed.join(', ')}. On Wayland, approve them in System Settings → Global Shortcuts → EchoDeck,
                  then press Re-register above. In-app hotkeys keep working either way.
                </div>
              )}
            </div>
          </div>
        </Group>
      )}
      <Group title="Sounds" desc={withHotkeys.length ? undefined : 'Assign hotkeys from a sound card menu or the sound editor'}>
        {withHotkeys.map((s) => (
          <div className="setting-row" key={s.id}>
            <div style={{ minWidth: 0 }}>
              <div className="setting-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </div>
            </div>
            <HotkeyCapture
              value={s.hotkey}
              onChange={(accel) => {
                if (accel === null) {
                  updateSound(s.id, { hotkey: null })
                  syncHotkeys()
                } else {
                  assignHotkey(s.id, accel)
                }
              }}
            />
          </div>
        ))}
      </Group>
    </>
  )
}

function AppearanceTab() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  return (
    <>
      <Group title="Accent" desc="Used for active states, playback and highlights">
        <div className="setting-row">
          <div className="setting-label">Accent color</div>
          <div className="accent-swatches">
            {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
              const a = ACCENTS[id]
              return (
                <button
                  key={id}
                  className={`accent-swatch${settings.accent === id ? ' on' : ''}`}
                  style={{ background: `hsl(${a.h} ${a.s}% ${a.l}%)`, color: `hsl(${a.h} ${a.s}% ${a.l}%)` }}
                  onClick={() => setSettings({ accent: id })}
                  aria-label={a.label}
                  data-tip={a.label}
                />
              )
            })}
          </div>
        </div>
      </Group>
      <Group title="Interface">
        <ToggleRow
          label="Reduce motion"
          desc="Minimizes animations across the interface"
          value={settings.reduceMotion}
          onChange={(v) => setSettings({ reduceMotion: v })}
        />
        <ToggleRow
          label="Show hotkeys on cards"
          desc="Display assigned keys on sound cards"
          value={settings.showHotkeys}
          onChange={(v) => setSettings({ showHotkeys: v })}
        />
      </Group>
    </>
  )
}

function StorageTab() {
  const sounds = useStore((s) => s.sounds)
  const [stats, setStats] = useState<{ bytes: number; count: number; dir: string } | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    void window.api.storageStats().then(setStats)
  }, [])

  const checkMissing = async () => {
    setChecking(true)
    const missing: string[] = []
    for (const s of sounds) {
      if (!(await window.api.soundExists(s.fileName))) missing.push(s.id)
    }
    setChecking(false)
    if (missing.length) {
      missing.forEach((id) => useStore.getState().deleteSound(id))
      useStore.getState().toast('warning', 'Removed missing sounds', `${missing.length} entries cleaned up`)
    } else {
      useStore.getState().toast('success', 'Library is healthy', 'All audio files found')
    }
    void window.api.storageStats().then(setStats)
  }

  const used = sounds.reduce((acc, s) => acc + (s.size || 0), 0)
  const pct = stats && stats.bytes > 0 ? Math.min(100, (used / stats.bytes) * 100) : 0

  return (
    <>
      <Group title="Usage">
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-md)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{sounds.length} sounds</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmtSize(used)}</span>
          </div>
          <div className="storage-bar">
            <div className="storage-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            {stats ? `${fmtSize(stats.bytes)} in library folder` : 'Calculating…'}
          </div>
        </div>
      </Group>
      <Group title="Maintenance">
        <div className="setting-row">
          <div>
            <div className="setting-label">Data folder</div>
            <div className="setting-desc">Imported audio files live here</div>
          </div>
          <button className="btn" onClick={() => window.api.openDataFolder()}>
            Open Folder
          </button>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Verify library</div>
            <div className="setting-desc">Remove entries whose files went missing</div>
          </div>
          <button className="btn" onClick={() => void checkMissing()} disabled={checking}>
            {checking ? 'Checking…' : 'Check Now'}
          </button>
        </div>
      </Group>
    </>
  )
}

function AboutTab() {
  const [info, setInfo] = useState<{ version: string; electron: string; chrome: string; node: string } | null>(null)
  useEffect(() => {
    void window.api.appInfo().then(setInfo)
  }, [])
  return (
    <>
      <div className="about-logo">
        <div className="about-mark">
          <LogoMark size={24} />
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>EchoDeck</div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--text-tertiary)' }}>
            {info ? `Version ${info.version}` : ''}
          </div>
        </div>
      </div>
      <Group title="System">
        {info &&
          [
            ['Electron', info.electron],
            ['Chromium', info.chrome],
            ['Node.js', info.node]
          ].map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span>{k}</span>
              <span>{v}</span>
            </div>
          ))}
      </Group>
      <Group title="Credits">
        <div style={{ padding: '4px 12px', fontSize: 'var(--fs-md)', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
          Built with Electron, React and Lucide icons.
          <br />
          Designed for Linux. MIT licensed.
        </div>
      </Group>
    </>
  )
}

export function SettingsOverlay() {
  const open = useStore((s) => s.settingsOpen)
  const tab = useStore((s) => s.settingsTab)
  const openSettings = useStore((s) => s.openSettings)
  const closeSettings = useStore((s) => s.closeSettings)
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const initialFocus = overlayRef.current?.querySelector<HTMLElement>('.settings-nav .nav-item.active')
      ?? overlayRef.current?.querySelector<HTMLElement>('button:not([disabled]):not([hidden])')
    initialFocus?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeSettings()
        return
      }
      if (e.key !== 'Tab' || !overlayRef.current) return
      const focusable = Array.from(
        overlayRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]):not([type="hidden"]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), a[href]:not([hidden]), [tabindex]:not([tabindex="-1"]):not([hidden])'
        )
      )
      if (!focusable.length) {
        e.preventDefault()
        overlayRef.current.focus()
        return
      }
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement)
      if (activeIndex === -1) {
        e.preventDefault()
        focusable[e.shiftKey ? focusable.length - 1 : 0].focus()
      } else if (e.shiftKey && activeIndex === 0) {
        e.preventDefault()
        focusable[focusable.length - 1].focus()
      } else if (!e.shiftKey && activeIndex === focusable.length - 1) {
        e.preventDefault()
        focusable[0].focus()
      }
    }
    // Keep this listener at the bubbling phase so a focused HotkeyCapture can
    // consume Escape before the settings shell closes.
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open, closeSettings])

  if (!open) return null

  return (
    <div ref={overlayRef} className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <nav className="settings-nav" aria-label="Settings sections">
        <div className="settings-title" id={titleId}>Settings</div>
        {TABS.map((t) => (
          <button key={t.id} className={`nav-item${tab === t.id ? ' active' : ''}`} onClick={() => openSettings(t.id)}>
            <t.icon size={15.5} />
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="settings-content">
        <div className="settings-content-inner">
          <div className="settings-section-title">{TABS.find((t) => t.id === tab)?.label}</div>
          <div className="settings-section-desc">
            {tab === 'general' && 'Behavior and system integration.'}
            {tab === 'audio' && 'Output device, volume and latency.'}
            {tab === 'hotkeys' && 'System-wide shortcuts for instant playback.'}
            {tab === 'appearance' && 'Make EchoDeck feel like yours.'}
            {tab === 'storage' && 'Library files and disk usage.'}
            {tab === 'about' && 'About this application.'}
          </div>
          {tab === 'general' && <GeneralTab />}
          {tab === 'audio' && <AudioTab />}
          {tab === 'hotkeys' && <HotkeysTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'storage' && <StorageTab />}
          {tab === 'about' && <AboutTab />}
        </div>
      </div>
    </div>
  )
}

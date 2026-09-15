import type { LatencyMode, Settings, Sound } from './types'
import { computePeaks } from './peaks'

type Voice = {
  source: AudioBufferSourceNode
  gain: GainNode
  sound: Sound
  startedAt: number
  duration: number
  stopping: boolean
}

type ProgressListener = (id: string, progress: number, playing: boolean) => void

const LATENCY: Record<LatencyMode, AudioContextLatencyCategory> = {
  low: 'interactive',
  balanced: 'balanced',
  efficient: 'playback'
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private voices = new Map<string, Voice>()
  private loading = new Map<string, Promise<AudioBuffer>>()
  private listeners = new Set<ProgressListener>()
  private raf = 0
  private lastEmit = 0
  private latencyMode: LatencyMode = 'balanced'
  private recreatePending = false
  private sinkId: string | null = null
  private pending = new Set<string>()
  private passthroughWanted = false
  private monitorWanted = false
  private monitorDeviceId: string | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private micGain: GainNode | null = null
  private monitorDest: MediaStreamAudioDestinationNode | null = null
  private monitorEl: HTMLAudioElement | null = null

  volume = 0.9
  muted = false
  onEnded: ((id: string) => void) | null = null
  onActiveChange: (() => void) | null = null

  private notify() {
    this.onActiveChange?.()
  }

  setLatencyMode(mode: LatencyMode): boolean {
    this.latencyMode = mode
    if (!this.ctx) return true
    if (this.voices.size) {
      this.recreatePending = true
      return false
    }
    this.teardownContext()
    return true
  }

  private teardownContext() {
    if (!this.ctx) return
    const old = this.ctx
    this.ctx = null
    this.master = null
    this.micSource = null
    this.micGain = null
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micStream = null
    if (this.monitorEl) {
      this.monitorEl.pause()
      this.monitorEl.srcObject = null
      this.monitorEl = null
    }
    this.monitorDest = null
    void old.close().catch(() => {})
    this.buffers.clear()
    this.loading.clear()
  }

  private maybeRecreateAfterStop() {
    if (this.recreatePending && this.voices.size === 0 && this.ctx) {
      this.teardownContext()
      this.recreatePending = false
    }
  }

  ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: LATENCY[this.latencyMode] })
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : this.volume
      this.master.connect(this.ctx.destination)
      const sink = this.sinkId
      if (sink) {
        const anyCtx = this.ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> }
        void anyCtx.setSinkId?.(sink).catch(() => {})
      }
      this.startLoop()
      if (this.passthroughWanted) void this.setMicPassthrough(true)
      if (this.monitorWanted) void this.setMonitor(true, this.monitorDeviceId)
    } else if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  async decode(fileName: string): Promise<{ buffer: AudioBuffer; peaks: number[]; duration: number }> {
    const ctx = this.ensure()
    const res = await fetch(`sound://media/${encodeURIComponent(fileName)}`)
    if (!res.ok) throw new Error(`Could not load ${fileName}`)
    const arr = await res.arrayBuffer()
    const buffer = await ctx.decodeAudioData(arr)
    return { buffer, peaks: computePeaks(buffer, 64), duration: buffer.duration }
  }

  getCached(id: string): AudioBuffer | undefined {
    return this.buffers.get(id)
  }

  private async loadBuffer(sound: Sound): Promise<AudioBuffer> {
    const cached = this.buffers.get(sound.id)
    if (cached) return cached
    const inflight = this.loading.get(sound.id)
    if (inflight) return inflight
    const p = this.decode(sound.fileName).then(({ buffer }) => {
      this.buffers.set(sound.id, buffer)
      return buffer
    })
    this.loading.set(sound.id, p)
    void p.finally(() => {
      if (this.loading.get(sound.id) === p) this.loading.delete(sound.id)
    }).catch(() => {})
    return p
  }

  isPlaying(id: string): boolean {
    return this.voices.has(id) || this.pending.has(id)
  }

  sampleRate(): number | null {
    return this.ctx?.sampleRate ?? null
  }

  activeIds(): string[] {
    return [...new Set([...this.voices.keys(), ...this.pending])]
  }

  progress(id: string): number {
    const v = this.voices.get(id)
    if (!v || !this.ctx) return 0
    const t = (this.ctx.currentTime - v.startedAt) % v.duration
    return v.duration ? t / v.duration : 0
  }

  onProgress(fn: ProgressListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private startLoop() {
    const tick = (now: number) => {
      if (this.voices.size && now - this.lastEmit > 33) {
        this.lastEmit = now
        for (const [id] of this.voices) {
          const p = this.progress(id)
          this.listeners.forEach((fn) => fn(id, p, true))
        }
      }
      this.raf = requestAnimationFrame(tick)
    }
    if (!this.raf) this.raf = requestAnimationFrame(tick)
  }

  async play(
    sound: Sound,
    opts: { stopOthers?: boolean } = {}
  ): Promise<boolean> {
    this.ensure()
    if (this.pending.has(sound.id)) return false
    if (this.voices.has(sound.id)) {
      this.stop(sound.id)
      return false
    }
    if (opts.stopOthers) this.stopAll()
    this.pending.add(sound.id)
    this.notify()
    let buffer: AudioBuffer
    try {
      buffer = await this.loadBuffer(sound)
    } catch {
      this.pending.delete(sound.id)
      this.notify()
      throw new Error('Audio file could not be loaded')
    }
    if (!this.pending.has(sound.id)) {
      this.notify()
      return false
    }
    this.pending.delete(sound.id)
    if (this.voices.has(sound.id)) return false

    const ctx = this.ctx && this.ctx.state !== 'closed' ? this.ctx : this.ensure()

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = sound.loop
    const gain = ctx.createGain()
    gain.gain.value = sound.volume
    source.connect(gain)
    gain.connect(this.master!)

    const voice: Voice = { source, gain, sound, startedAt: ctx.currentTime, duration: buffer.duration, stopping: false }
    this.voices.set(sound.id, voice)

    source.onended = () => {
      const v = this.voices.get(sound.id)
      if (v && v.source === source && !v.stopping) {
        this.voices.delete(sound.id)
        this.listeners.forEach((fn) => fn(sound.id, 1, false))
        this.onEnded?.(sound.id)
        this.notify()
        this.maybeRecreateAfterStop()
      }
    }

    if (ctx.state === 'suspended') await ctx.resume()
    source.start()

    this.listeners.forEach((fn) => fn(sound.id, 0, true))
    this.notify()
    return true
  }

  stop(id: string) {
    this.pending.delete(id)
    const v = this.voices.get(id)
    if (!v) {
      this.notify()
      return
    }
    v.stopping = true
    this.voices.delete(id)
    try {
      v.source.stop()
    } catch {
      /* already stopped */
    }
    v.source.disconnect()
    v.gain.disconnect()
    this.listeners.forEach((fn) => fn(id, 0, false))
    this.notify()
    this.maybeRecreateAfterStop()
  }

  stopAll() {
    // Cancel queued plays as well as currently playing voices. A load may still
    // resolve asynchronously, so clearing `pending` prevents it from starting.
    const hadVoices = this.voices.size > 0
    const hadPending = this.pending.size > 0
    this.pending.clear()
    for (const id of [...this.voices.keys()]) this.stop(id)
    if (hadPending && !hadVoices) this.notify()
  }

  applyVolume(sound: Sound) {
    const v = this.voices.get(sound.id)
    if (!v) return
    v.gain.gain.value = sound.volume
    v.source.loop = sound.loop
    v.sound = sound
  }

  async setMicPassthrough(on: boolean): Promise<boolean> {
    this.passthroughWanted = on
    const ctx = this.ensure()
    if (on) {
      if (this.micStream) return true
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        })
        if (!this.passthroughWanted) {
          stream.getTracks().forEach((t) => t.stop())
          return true
        }
        this.micStream = stream
        const source = ctx.createMediaStreamSource(stream)
        const gain = ctx.createGain()
        gain.gain.value = 1
        source.connect(gain)
        gain.connect(this.master!)
        this.micSource = source
        this.micGain = gain
        return true
      } catch {
        return false
      }
    }
    if (this.micSource) {
      this.micSource.disconnect()
      this.micGain?.disconnect()
      this.micSource = null
      this.micGain = null
    }
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micStream = null
    return true
  }

  async setMonitor(on: boolean, deviceId: string | null): Promise<boolean> {
    this.monitorWanted = on
    this.monitorDeviceId = deviceId
    const ctx = this.ensure()
    if (on) {
      if (!this.monitorDest) {
        this.monitorDest = ctx.createMediaStreamDestination()
        this.master!.connect(this.monitorDest)
      }
      if (!this.monitorEl) {
        const el = new Audio()
        el.autoplay = true
        el.srcObject = this.monitorDest.stream
        const anyEl = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
        if (deviceId && anyEl.setSinkId) {
          try {
            await anyEl.setSinkId(deviceId)
          } catch {
            /* falls back to default */
          }
        }
        try {
          await el.play()
        } catch {
          /* autoplay policy */
        }
        this.monitorEl = el
      }
      return true
    }
    if (this.monitorEl) {
      this.monitorEl.pause()
      this.monitorEl.srcObject = null
      this.monitorEl = null
    }
    if (this.monitorDest) {
      this.master?.disconnect(this.monitorDest)
      this.monitorDest = null
    }
    return true
  }

  async setMonitorDevice(deviceId: string | null): Promise<boolean> {
    this.monitorDeviceId = deviceId
    if (!this.monitorEl) return true
    const anyEl = this.monitorEl as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
    if (!anyEl.setSinkId) return false
    try {
      await anyEl.setSinkId(deviceId ?? '')
      return true
    } catch {
      return false
    }
  }

  setMasterVolume(v: number, muted: boolean) {
    this.volume = v
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : v
  }

  async setOutputDevice(deviceId: string | null): Promise<boolean> {
    const ctx = this.ensure()
    const anyCtx = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> }
    if (!anyCtx.setSinkId) return false
    try {
      await anyCtx.setSinkId(deviceId ? deviceId : '')
      this.sinkId = deviceId ?? null
      return true
    } catch {
      return false
    }
  }

  async listOutputs(): Promise<{ deviceId: string; label: string; isDefault: boolean }[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const outs = devices.filter((d) => d.kind === 'audiooutput')
      const defaultId = outs.find((d) => d.deviceId === 'default')?.deviceId
      return outs.map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Output ${i + 1}`,
        isDefault: d.deviceId === 'default' || (d.deviceId === defaultId && i === 0)
      }))
    } catch {
      return []
    }
  }
}

export const engine = new AudioEngine()

export async function listOutputDevices() {
  return engine.listOutputs()
}

async function findVirtualMicDevice(retries = 4): Promise<{ deviceId: string; label: string } | null> {
  const wanted = window.api.platform === 'win32' ? /CABLE Input/i : 'EchoDeck Sounds'
  for (let i = 0; i < retries; i++) {
    const devices = await engine.listOutputs()
    const match = devices.find((d) =>
      typeof wanted === 'string' ? d.label.includes(wanted) : wanted.test(d.label)
    )
    if (match) return match
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

export async function routeOutput(settings: Settings): Promise<boolean> {
  if (settings.virtualMic) {
    const v = await findVirtualMicDevice()
    if (v) {
      engine.setMasterVolume(settings.masterVolume, settings.muted)
      return engine.setOutputDevice(v.deviceId)
    }
    return false
  }
  return engine.setOutputDevice(settings.outputDeviceId ?? '')
}

export async function applyWindowsVirtualMic(settings: Settings): Promise<boolean> {
  // Always apply the current output routing. Disabling the virtual mic must
  // restore the configured output device instead of leaving the CABLE sink
  // selected on the AudioContext.
  const routed = await routeOutput(settings)
  void engine.setMicPassthrough(settings.virtualMic && settings.virtualMicIncludeMic)
  void engine.setMonitor(settings.virtualMic && settings.virtualMicMonitor, settings.outputDeviceId)
  return routed
}

export function applyAudioSettings(settings: Settings) {
  engine.setMasterVolume(settings.masterVolume, settings.muted)
  void engine.setOutputDevice(settings.outputDeviceId)
}

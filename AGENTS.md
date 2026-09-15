# AGENTS.md

Electron + React + TypeScript soundboard (electron-vite layout: `src/main`, `src/preload`, `src/renderer`). No lint/test framework; strict `tsc --noEmit` is the gate.

## Commands

```bash
npx tsc --noEmit          # typecheck (run first)
npx electron-vite build   # build main/preload/renderer to out/
node scripts/smoke.mjs    # headless UI test (jsdom) — run AFTER build; loads out/renderer
npm run dev               # electron-vite dev (HMR)
npm run dist              # electron-builder AppImage+deb
```

- Sandbox has no system Node. Bootstrap: `mkdir -p /tmp/opencode/node && cd /tmp/opencode/node && curl -fsSL https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz | tar -xJ --strip-components=1`, then `export PATH=/tmp/opencode/node/bin:$PATH`. /tmp is wiped between sessions — re-check `test -x /tmp/opencode/node/bin/node`.
- Install deps with `ELECTRON_SKIP_BINARY_DOWNLOAD=1` for speed; the binary is only needed to actually run the app (`cd node_modules/electron && node install.js`).

## Sandbox quirks (this is a Flatpak runtime; user has a real KDE Wayland session)

- `XDG_CONFIG_HOME` here points into the Flatpak dir, so Electron's userData differs from the user's real one. To test against real user data launch with `XDG_CONFIG_HOME=/home/omerkerem/.config`.
- Sandbox cannot see user-session processes (`ps` shows nothing from their session) but shares home dir, PulseAudio (`pactl`), and Wayland.
- Single-instance lock misfires across that boundary → always add `--no-singleton` for sandbox test launches. Keep the lock for real usage.
- Launch flags needed here: `--no-sandbox --disable-gpu --ozone-platform-hint=auto`. GPU process and the singleton lock fail intermittently otherwise; `--disable-gpu` avoids fatal "GPU process isn't usable".
- Launch detached: `setsid nohup <cmd> > log 2>&1 < /dev/null & disown`. Backgrounded children get SIGTERM'd when the bash tool call times out, even with nohup. `pkill` in compound commands errors out ("Unknown: ChildProcess.kill") but still works — verify with `ps aux | grep "[e]lectron" | grep -v crashpad | wc -l`.
- dbus "Failed to connect to the bus" errors in logs are harmless noise.

## Architecture / gotchas

- Renderer is the source of truth; main persists `{settings, soundboards, sounds}` to `library.json` (debounced 250ms, whole-state writes). Audio files live in `userData/sounds/`, served to the renderer via the custom `sound://` protocol (registered via `registerSchemesAsPrivileged` before app ready; CSP in `index.html` must include it in `connect-src`).
- Virtual microphone (PipeWire via `pactl`): two `module-null-sink`s (`echodeck_sounds`, `echodeck_virtual_mic`) + loopbacks (sounds→mic, default mic→mic, optional sounds→speakers). **Quoting matters**: `sink_properties="device.description='Label With Spaces'"` — plain `device.description="X Y"` gets truncated at the first space by PipeWire modargs (Chromium then sees a wrong label and `setSinkId` routing silently fails). `cleanupLegacyModules()` migrates old-style modules on enable.
- Output routing: `routeOutput()` in `lib/audio.ts` matches device by label `includes('EchoDeck Sounds')` and `setSinkId`s the AudioContext; the engine stores the sink and re-applies it after context recreation. `navigator.mediaDevices.ondevicechange` re-routes.
- Virtual mic on Windows uses the VB-Cable driver: `vbcable:install` IPC downloads the official zip (URLs versioned in `src/main/index.ts` — they rot when VB-Audio bumps the pack number), extracts via PowerShell `Expand-Archive`, launches `VBCABLE_Setup_x64.exe` elevated. Renderer-side, `applyWindowsVirtualMic()` (lib/audio.ts) routes output to "CABLE Input", pipes the real mic in via getUserMedia→WebAudio, and local monitoring uses a hidden `<audio>` element with its own `setSinkId`. Driver detection is a label regex on `enumerateDevices` — labels differ from Linux.
- Global hotkeys: Electron `globalShortcut` in main; suspended via IPC while the capture UI is listening (otherwise shortcuts swallow the keys being captured). Wayland needs Electron 34+ with `GlobalShortcutsPortal` feature flag. In-app fallback in `App.tsx` matches assigned hotkeys on keydown while the window is focused — keep it in sync with reserved combos (`Ctrl+K`, `Ctrl+F`).
- Waveform playback progress: one rAF loop in the engine emits progress; listeners set `--wave-progress` CSS var. Do not re-render React per frame.
- Design tokens are CSS custom properties in `styles/tokens.css`; accents defined in `lib/accents.ts` (applied as vars at runtime). Icons: lucide-react only, mapped through `components/icons.ts`.
- `scripts/smoke.mjs` mocks `window.api` — any new preload API must be added to that mock or the app crashes at init in the test.
- `scripts/generate_assets.py` regenerates demo WAVs and `resources/icon.png` (512px; pure python; icon must be RGBA — the PNG encoder writes 4-byte pixels, don't regress to 3). `scripts/generate_cover.py` makes the itch.io cover (630×500, bitmap-font wordmark).
- `extraResources` in package.json needs the explicit `{from, to}` form — a bare path packs `resources/demo` to `resources/resources/demo` and the packaged app silently finds no demo files.
- All runtime deps live in `devDependencies` (Vite bundles them); electron-builder packs only `out/` + a 1.3MB asar. Adding something to `dependencies` balloons the package with unused node_modules.
- AppImage smoke pattern: `./EchoDeck.AppImage --appimage-extract`, then `APPDIR=$PWD/squashfs-root ./squashfs-root/AppRun …` (APPDIR is only set by the real AppImage runtime).
- Windows builds: `npm run dist:win` outputs to `release-win/` (separate from Linux `release/`). `win.signAndEditExecutable=false` is required — wine is unavailable, so the exe keeps the default Electron file icon. The sandbox's electron-builder NSIS cache has a broken makensis (rejects `!include`/`!addincludedir`, its own includes use `!define /IfNDef`) — only the `zip` target builds here; test NSIS on a machine with working NSIS. Virtual-mic UI is hidden on non-Linux via `window.api.platform` (add it to the smoke mock when adding new preload fields).
- `resources/EchoDeck.desktop` (filename must stay exactly `EchoDeck.desktop` — the KDE GlobalShortcuts portal resolves the app_id `--class=EchoDeck` against it for hotkey approval) is installed to `~/.local/share/applications` and `~/Masaüstü/EchoDeck.desktop`; its `Exec` line duplicates the runtime flags — keep in sync when launch flags change.
- Users run the app from `~/Masaüstü/EchoDeck.desktop`; quit triggers virtual-mic teardown (`will-quit` → modules unloaded), so the game's mic selection breaks when the app exits — expected.

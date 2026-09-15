# itch.io distribution

## Build

```bash
npm run dist       # Linux: AppImage + deb → release/
npm run dist:win   # Windows: NSIS + zip → release-win/ (separate folder)
```

Produces `release/EchoDeck-<version>.AppImage` (and a `.deb`) for Linux, and
`release-win/EchoDeck-<version>-x64.zip` (+ `EchoDeck-Setup-<version>.exe` when
NSIS tooling is available) for Windows. Verify before uploading:

```bash
release/EchoDeck-1.0.0.AppImage --appimage-extract   # then:
APPDIR=$PWD/squashfs-root ./squashfs-root/AppRun     # needs APPDIR when run extracted
```

Smoke-check: the app window opens, first launch seeds the five demo sounds
(Settings → Storage shows 5 sounds), audio plays. For the Windows zip, extract
and confirm `EchoDeck.exe` + `resources/demo/` are present.

## Upload (butler)

```bash
butler push release/EchoDeck-1.0.0.AppImage <your-user>/echodeck:linux --userversion 1.0.0
butler push release-win/EchoDeck-1.0.0-x64.zip <your-user>/echodeck:windows --userversion 1.0.0
```

Butler handles delta patches, so subsequent versions are cheap uploads. Bump
`version` in `package.json` (and `app:info` shown in Settings → About follows
automatically) before every release build.

## Page setup

- **Kind of project**: Downloadable · **Classification**: Tool (or Game if you
  prefer reach)
- **Cover**: `resources/cover.png` (630×500, already generated)
- **Screenshots**: capture the sound grid with a few playing cards (the accent
  "playing" state is the money shot), the Add Sounds modal, and Settings →
  Virtual microphone — that panel is the differentiator
- **Kind & genre tags**: `soundboard`, `audio`, `utility`, `streaming`,
  `voice-chat`
- **Minimum description** (paste and adjust):

  > EchoDeck is a premium desktop soundboard for Linux. Trigger sounds with
  > global hotkeys — even inside fullscreen games — and play them straight into
  > your voice chat through a virtual microphone while your normal voice keeps
  > passing through. Multiple sounds at once, per-sound volume and loop,
  > favorites, search, a command palette, and a dark interface that gets out of
  > your way.
  >
  > **Linux (AppImage)**: download, `chmod +x`, run. Requires PipeWire or
  > PulseAudio (any modern distro).

- **Price**: free / pay-what-you-want works well for utilities.

## Known platform notes for the page (set expectations)

- **Virtual microphone** on both platforms. Linux uses a built-in PipeWire
  device (zero setup). Windows uses the free VB-Cable driver — Settings →
  Audio has a one-click **Install VB-Cable** button that downloads the
  official installer from vb-audio.com and launches it.
- **Windows**: download the zip, extract, run `EchoDeck.exe` (no installer
  needed). The exe shows the default Electron file icon (packaging is done
  without resource editing); the window/taskbar icon is correct at runtime.
  On Windows the game/Discord input device is called
  "CABLE Output (VB-Audio Virtual Cable)".
- Global hotkeys on Linux/Wayland require KDE Plasma 6 (portal approval on
  first run); on X11 and Windows they work natively. In-app hotkeys always
  work.
- Quitting EchoDeck removes the virtual mic (Linux) — voice-chat apps will
  need their input device re-selected after quitting.

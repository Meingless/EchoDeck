import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { JSDOM, VirtualConsole } from 'jsdom'

const rendererDir = resolve(process.cwd(), 'out/renderer')
const html = readFileSync(join(rendererDir, 'index.html'), 'utf8')
const assets = readdirSync(join(rendererDir, 'assets'))
const js = assets.find((f) => f.endsWith('.js'))

const errors = []
const vc = new VirtualConsole()
vc.on('jsdomError', (e) => {
  if (!String(e).includes('Could not load link')) errors.push(String(e))
})
vc.on('error', (...a) => errors.push(a.join(' ')))

const dom = new JSDOM(
  html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/, `<script src="./assets/${js}"></script>`),
  {
    url: `file://${join(rendererDir, 'index.html')}`,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc
  }
)

const { window } = dom

let suspendHotkeysCalls = 0
let resumeHotkeysCalls = 0

window.api = {
  platform: 'linux',
  loadState: async () => ({
    version: 1,
    settings: {},
    soundboards: [
      { id: 'sb-gaming', name: 'Gaming' },
      { id: 'sb-memes', name: 'Memes' }
    ],
    sounds: [
      {
        id: 's1', name: 'Airhorn', fileName: 'a.wav', duration: 3.2,
        peaks: Array.from({ length: 64 }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i / 5))),
        volume: 1, loop: false, hotkey: 'F1', favorite: true, soundboardId: 'sb-gaming',
        playCount: 4, lastPlayedAt: Date.now() - 1000, addedAt: 1, size: 12345
      },
      {
        id: 's2', name: 'Vine Boom', fileName: 'b.wav', duration: 1.4,
        peaks: Array.from({ length: 64 }, (_, i) => 0.2 + 0.5 * Math.abs(Math.cos(i / 3))),
        volume: 0.8, loop: true, hotkey: null, favorite: false, soundboardId: 'sb-gaming',
        playCount: 1, lastPlayedAt: null, addedAt: 2, size: 999
      }
    ]
  }),
  saveState: () => {},
  openFiles: async () => null,
  importFiles: async () => [],
  deleteSoundFile: () => {},
  soundExists: async () => true,
  storageStats: async () => ({ bytes: 1000, count: 2, dir: '/tmp' }),
  revealSound: () => {},
  openDataFolder: () => {},
  syncHotkeys: () => {},
  suspendHotkeys: () => { suspendHotkeysCalls++ },
  resumeHotkeys: () => { resumeHotkeysCalls++ },
  appInfo: async () => ({ version: '1.0.0', electron: '33', chrome: '130', node: '20' }),
  setLoginItem: () => {},
  setVirtualMic: async () => ({ ok: true }),
  installVBCable: async () => ({ ok: true }),
  openExternal: () => {},
  hotkeysDiagnose: async () => ({ sessionType: 'wayland', desktop: 'KDE', plasmaVersion: '6.1', portalRunning: true, globalShortcuts: true }),
  pathForFile: () => null,
  onTriggerSound: () => {},
  onStopAll: () => {},
  onGlobalShortcutStatus: () => {}
}

function settle(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  await settle(700)
  const checks = []
  const check = (name, cond) => checks.push([name, !!cond])
  try {
    const doc = window.document
  const $ = (s) => doc.querySelector(s)
  const $$ = (s) => doc.querySelectorAll(s)

  check('topbar', $('.topbar'))
  check('brand name', $('.brand-name')?.textContent === 'EchoDeck')
  check('search input', $('.search-input'))
  check('stop all button', $('.stopall-btn'))
  check('sidebar', $('.sidebar'))
  check('library items', $$('.nav-item').length >= 3)
  check('soundboards rendered', doc.body.textContent.includes('Gaming') && doc.body.textContent.includes('Memes'))
  check('sound cards', $$('.sound-card').length === 2)
  check('card name', doc.body.textContent.includes('Airhorn'))
  check('hotkey cap F1', doc.body.textContent.includes('F1'))
  check('favorite marked', $('.card-fav.on'))
  check('loop badge', $('.card-loop'))
  check('playing pill absent initially', !$('.card-playing-pill'))
  check('waveform bars', $$('.waveform .bar').length > 100)
  check('statusbar', $('.statusbar'))
  check('add sound button', doc.body.textContent.includes('Add Sound'))
  check('filter chips', doc.body.textContent.includes('Most Played'))

  // Custom soundboard views should filter the same source of truth as All Sounds.
  const gamingBoard = [...$$('.nav-item')].find((b) => b.textContent.includes('Gaming'))
  const memesBoard = [...$$('.nav-item')].find((b) => b.textContent.includes('Memes'))
  gamingBoard?.click()
  await settle(50)
  check('custom board filters matching sounds', $$('.sound-card').length === 2 && $('.main-title')?.textContent === 'Gaming')
  memesBoard?.click()
  await settle(50)
  check('empty custom board has no cards', $$('.sound-card').length === 0 && doc.body.textContent.includes('Nothing here yet'))
  const allSoundsNav = [...$$('.nav-item')].find((b) => b.textContent.includes('All Sounds'))
  allSoundsNav?.click()
  await settle(50)
  check('returning to all sounds restores cards', $$('.sound-card').length === 2)

  $('.play-btn')?.click()
  await settle(80)
  check('no audio engine crash on click (no AudioContext mock)', true)

  const searchInput = $('#global-search')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(searchInput, 'air')
  searchInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  await settle(80)
  check('fuzzy search narrows grid', $$('.sound-card').length === 1)
  setter.call(searchInput, 'zzz')
  searchInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  await settle(80)
  check('empty search state', doc.body.textContent.includes('No results'))
  setter.call(searchInput, '')
  searchInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  await settle(80)

  // Command palette via Ctrl+K
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
  await settle(120)
  check('palette opens with ctrl+k', !!$('.palette'))
  const paletteInput = $('.palette-input')
  setter.call(paletteInput, 'vine')
  paletteInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  await settle(80)
  check('palette fuzzy filters', $('.palette')?.textContent.includes('Vine Boom'))
  paletteInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await settle(60)
  check('palette closes with escape', !$('.palette'))

  // Settings overlay + every tab
  const settingsBtn = [...$$('.icon-btn')].find((b) => b.getAttribute('aria-label') === 'Settings')
  settingsBtn.click()
  await settle(80)
  check('settings opens', !!$('.settings-overlay'))
  const tabs = {
    Audio: 'Virtual microphone',
    Hotkeys: 'Stop all sounds',
    Appearance: 'Accent color',
    Storage: 'Verify library',
    About: 'Version'
  }
  for (const [t, expect] of Object.entries(tabs)) {
    const btn = [...$$('.settings-nav .nav-item')].find((b) => b.textContent.includes(t))
    btn?.click()
    await settle(50)
    check(`settings ${t} tab`, $('.settings-content')?.textContent.includes(expect))
  }
  const hotkeysTab = [...$$('.settings-nav .nav-item')].find((b) => b.textContent.includes('Hotkeys'))
  hotkeysTab?.click()
  await settle(50)
  const stopAllCapture = $('.settings-content .hotkey-box')
  stopAllCapture?.click()
  await settle(40)
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }))
  await settle(40)
  check('reserved stop-all hotkey rejected', stopAllCapture?.classList.contains('listening'))
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await settle(40)
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await settle(60)
  check('settings closes with escape', !$('.settings-overlay'))

  // Add sound modal: initial focus, focus trap, and restoration on close.
  const addBtn = [...$$('.main-header-actions .btn')].find((b) => b.textContent.includes('Add Sound'))
  addBtn.focus()
  addBtn.click()
  await settle(60)
  check('add modal opens', !!$('.dropzone'))
  const addModal = $('.dropzone')?.closest('.modal')
  const modalClose = addModal?.querySelector('button[aria-label="Close"]')
  check('modal initial focus is close button', window.document.activeElement === modalClose)
  const browseButton = addModal?.querySelector('.btn')
  browseButton?.focus()
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  check('modal tab wraps focus at the end', window.document.activeElement === modalClose)
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await settle(60)
  check('add modal closes', !$('.dropzone'))
  check('modal restores previous focus', window.document.activeElement === addBtn)

  // Deleting a board requires confirmation and removes it after confirmation.
  const memesForDelete = [...$$('.nav-item')].find((b) => b.textContent.includes('Memes'))
  memesForDelete?.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }))
  await settle(50)
  const deleteBoardMenuItem = [...$$('.ctx-item')].find((b) => b.textContent.trim() === 'Delete')
  deleteBoardMenuItem?.click()
  await settle(60)
  const boardConfirm = [...$$('.modal')].find((m) => m.textContent.includes('Delete soundboard?'))
  check('board delete asks for confirmation', !!boardConfirm)
  const boardConfirmButton = boardConfirm?.querySelector('.btn-danger')
  boardConfirmButton?.click()
  await settle(80)
  check('confirmed board delete removes board', ![...$$('.nav-item')].some((b) => b.textContent.includes('Memes')))

  // Context menu -> editor
  const card = $('.sound-card')
  card.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }))
  await settle(60)
  check('context menu opens', !!$('.ctx-menu'))
  const editItem = [...$$('.ctx-item')].find((b) => b.textContent.trim() === 'Edit')
  check('context menu edit item', !!editItem)
  editItem?.click()
  await settle(80)
  check('editor panel opens', !!$('.editor-panel.open'))
  check('editor shows hotkey capture', !!$('.editor-panel .hotkey-box'))
  const editorWave = $('.editor-panel .editor-wave')
  check('editor waveform uses native keyboard button', editorWave?.tagName === 'BUTTON' && editorWave?.getAttribute('type') === 'button')
  editorWave?.focus()
  editorWave?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  check('editor waveform remains keyboard focusable', window.document.activeElement === editorWave)

  const hotkeyBox = $('.editor-panel .hotkey-box')
  hotkeyBox?.click()
  await settle(50)
  check('hotkey capture enters listening state', hotkeyBox?.classList.contains('listening'))
  check('hotkeys suspended while capturing', suspendHotkeysCalls > 0)
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await settle(50)
  check('hotkey capture cancels with escape', !hotkeyBox?.classList.contains('listening'))
  check('hotkeys resumed after capture', resumeHotkeysCalls > 0)
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await settle(80)
  check('editor closes with escape', !$('.editor-panel.open'))
  check('context menu closed', !$('.ctx-menu'))

  // Error toast path (no AudioContext in jsdom -> play fails gracefully)
  const playBtn = $('.play-btn')
  playBtn.click()
  await settle(120)
  check('play failure shows error toast', !!$('.toast'))
  } catch (e) {
    errors.push('interaction: ' + e.stack)
  }

  const checks2 = checks
  void checks2
  let failed = 0
  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
    if (!ok) failed++
  }
  if (errors.length) {
    console.log('\nRuntime errors:')
    for (const e of errors.slice(0, 5)) console.log('  ', e.split('\n')[0])
    failed += errors.length
  }
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error('SMOKE TEST CRASH:', e)
  process.exit(1)
})

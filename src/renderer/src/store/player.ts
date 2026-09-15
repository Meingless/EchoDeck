import { create } from 'zustand'
import { engine } from '@/lib/audio'
import { useStore } from './store'

type PlayerState = {
  active: string[]
  toggle: (id: string) => void
  stop: (id: string) => void
  stopAll: () => void
  refresh: () => void
}

engine.onEnded = () => usePlayer.getState().refresh()
engine.onActiveChange = () => usePlayer.getState().refresh()

export const usePlayer = create<PlayerState>((set) => ({
  active: [],

  refresh() {
    set({ active: engine.activeIds() })
  },

  toggle(id) {
    const { sounds, settings, playCountUp, toast } = useStore.getState()
    const sound = sounds.find((s) => s.id === id)
    if (!sound) return
    if (engine.isPlaying(id)) {
      engine.stop(id)
      set({ active: engine.activeIds() })
      return
    }
    engine
      .play(sound, { stopOthers: settings.stopOthersOnPlay })
      .then((started) => {
        set({ active: engine.activeIds() })
        if (started) playCountUp(id)
      })
      .catch(() => toast('error', 'Audio file could not be loaded', sound.name))
  },

  stop(id) {
    engine.stop(id)
    set({ active: engine.activeIds() })
  },

  stopAll() {
    engine.stopAll()
    set({ active: [] })
  }
}))

import type { LucideIcon } from 'lucide-react'
import {
  Play, Square, Star, Pencil, Keyboard, FolderInput, Copy, Trash2, FolderOutput, Music,
  Plus, Volume2, Headphones, Settings, Command, Import, RefreshCw, Layers, Check, X, Info,
  AlertTriangle, CircleAlert, CircleCheck, CircleX, Heart, ArrowRightLeft, History, ListMusic
} from 'lucide-react'

export const ICONS: Record<string, LucideIcon> = {
  play: Play,
  stop: Square,
  star: Star,
  heart: Heart,
  pencil: Pencil,
  keyboard: Keyboard,
  'folder-input': FolderInput,
  copy: Copy,
  trash: Trash2,
  'folder-output': FolderOutput,
  music: Music,
  plus: Plus,
  volume: Volume2,
  headphones: Headphones,
  settings: Settings,
  command: Command,
  import: Import,
  refresh: RefreshCw,
  layers: Layers,
  check: Check,
  x: X,
  info: Info,
  warning: AlertTriangle,
  error: CircleAlert,
  success: CircleCheck,
  fail: CircleX,
  move: ArrowRightLeft,
  history: History,
  list: ListMusic
}

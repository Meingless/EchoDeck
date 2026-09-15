import { useStore } from '@/store/store'
import { ICONS } from './icons'
import { X } from 'lucide-react'
import type { ToastKind } from '@/lib/types'

const ICON_KEY: Record<ToastKind, string> = {
  success: 'success',
  warning: 'warning',
  error: 'fail',
  info: 'info'
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[ICON_KEY[t.kind]]
        return (
          <div key={t.id} className="toast">
            <div className={`toast-icon ${t.kind}`}>
              <Icon size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-message">{t.message}</div>}
            </div>
            <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

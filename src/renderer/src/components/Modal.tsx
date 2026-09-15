import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function Modal({
  title,
  onClose,
  children,
  footer,
  width,
  initialFocusRef
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
  initialFocusRef?: RefObject<HTMLElement | null>
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  onCloseRef.current = onClose

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const initialFocus = initialFocusRef?.current ?? modalRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]):not([type="hidden"]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), a[href]:not([hidden]), [tabindex]:not([tabindex="-1"]):not([hidden])'
    )
    ;(initialFocus ?? modalRef.current)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }

      if (e.key !== 'Tab' || !modalRef.current) return

      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]):not([type="hidden"]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), a[href]:not([hidden]), [tabindex]:not([tabindex="-1"]):not([hidden])'
        )
      )
      if (!focusable.length) {
        e.preventDefault()
        modalRef.current.focus()
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
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [initialFocusRef])

  return createPortal(
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={modalRef}
        className="modal"
        style={width ? { width: `min(${width}px, calc(100vw - 48px))` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div className="modal-title" id={titleId}>
            {title}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close" data-tip="Close">
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onClose
}: {
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      title={title}
      onClose={onClose}
      width={420}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-body">{message}</div>
    </Modal>
  )
}

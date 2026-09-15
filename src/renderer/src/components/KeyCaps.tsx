import { acceleratorToKeys } from '@/lib/hotkeys'

export function KeyCaps({ accel, className }: { accel: string | null | undefined; className?: string }) {
  const keys = acceleratorToKeys(accel)
  if (!keys.length) return null
  return (
    <span className={className}>
      {keys.map((k, i) => (
        <kbd key={`${k}-${i}`}>{k}</kbd>
      ))}
    </span>
  )
}

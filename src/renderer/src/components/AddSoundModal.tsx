import { useRef, useState } from 'react'
import { FileAudio2 } from 'lucide-react'
import { Modal } from './Modal'
import { useStore } from '@/store/store'

export function AddSoundModal() {
  const open = useStore((s) => s.addOpen)
  const setAddOpen = useStore((s) => s.setAddOpen)
  const importPaths = useStore((s) => s.importPaths)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const paths = [...files].map((f) => window.api.pathForFile(f)).filter((p): p is string => !!p)
    if (paths.length) {
      const count = await importPaths(paths)
      if (count > 0) setAddOpen(false)
    }
    setBusy(false)
  }

  return (
    <Modal title="Add Sounds" onClose={() => setAddOpen(false)} width={480}>
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
        aria-label="Drop audio files here or browse"
      >
        <div className="dropzone-icon">
          <FileAudio2 size={22} />
        </div>
        <div className="dropzone-title">{busy ? 'Importing…' : 'Drop audio files here'}</div>
        <div className="dropzone-hint">or</div>
        <button type="button" className="btn" onClick={() => inputRef.current?.click()} style={{ marginTop: 6 }}>
          Browse Files
        </button>
        <div className="dropzone-formats">MP3 · WAV · OGG · FLAC</div>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.ogg,.oga,.flac,.m4a,.aac,.webm,audio/*"
          multiple
          hidden
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>
    </Modal>
  )
}

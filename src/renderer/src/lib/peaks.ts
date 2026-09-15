export function computePeaks(buffer: AudioBuffer, bars = 64): number[] {
  const data = buffer.getChannelData(0)
  const block = Math.max(1, Math.floor(data.length / bars))
  const peaks: number[] = []
  for (let i = 0; i < bars; i++) {
    let sum = 0
    const start = i * block
    const end = Math.min(data.length, start + block)
    const step = Math.max(1, Math.floor((end - start) / 512))
    let n = 0
    for (let j = start; j < end; j += step) {
      sum += data[j] * data[j]
      n++
    }
    peaks.push(Math.sqrt(sum / Math.max(1, n)))
  }
  const max = Math.max(...peaks, 0.0001)
  return peaks.map((p) => Math.max(0.05, Math.min(1, p / max)))
}

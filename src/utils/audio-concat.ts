/**
 * Audio concatenation utilities for combining multiple audio chapters
 * into a single audiobook file with chapter timing metadata.
 */

export type ChapterTiming = {
  id: string
  title: string
  startTime: number
  endTime: number
  duration: number
}

export type ConcatResult = {
  blob: Blob
  duration: number
  chapterTimings: ChapterTiming[]
}

export type ChapterAudio = {
  id: string
  title: string
  blob: Blob
}

/**
 * Decodes an audio Blob to an AudioBuffer
 */
async function decodeAudioBlob(
  blob: Blob,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer()
  return await audioContext.decodeAudioData(arrayBuffer)
}

/**
 * Encodes an AudioBuffer to WAV format
 */
function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitsPerSample = 16

  // Interleave channels
  const length = buffer.length * numChannels * (bitsPerSample / 8)
  const outputBuffer = new ArrayBuffer(44 + length)
  const view = new DataView(outputBuffer)

  // Write WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF chunk descriptor
  writeString(0, "RIFF")
  view.setUint32(4, 36 + length, true)
  writeString(8, "WAVE")

  // fmt sub-chunk
  writeString(12, "fmt ")
  view.setUint32(16, 16, true) // Subchunk1Size
  view.setUint16(20, format, true) // AudioFormat
  view.setUint16(22, numChannels, true) // NumChannels
  view.setUint32(24, sampleRate, true) // SampleRate
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true) // ByteRate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true) // BlockAlign
  view.setUint16(34, bitsPerSample, true) // BitsPerSample

  // data sub-chunk
  writeString(36, "data")
  view.setUint32(40, length, true)

  // Write interleaved audio data
  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch))
  }

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return outputBuffer
}

/**
 * Concatenates multiple audio chapters into a single WAV file
 * with chapter timing metadata.
 */
export async function concatenateAudioChapters(
  chapters: ChapterAudio[],
  onProgress?: (chapterIndex: number, total: number) => void
): Promise<ConcatResult> {
  if (chapters.length === 0) {
    throw new Error("No chapters to concatenate")
  }

  // Create audio context for decoding
  const audioContext = new AudioContext()

  try {
    // Decode all chapter blobs to AudioBuffers
    const decodedBuffers: { id: string; title: string; buffer: AudioBuffer }[] = []

    for (let i = 0; i < chapters.length; i++) {
      onProgress?.(i, chapters.length)
      const chapter = chapters[i]
      const buffer = await decodeAudioBlob(chapter.blob, audioContext)
      decodedBuffers.push({
        id: chapter.id,
        title: chapter.title,
        buffer
      })
    }

    // Calculate total duration and determine output parameters
    let totalDuration = 0
    const chapterTimings: ChapterTiming[] = []

    for (const { id, title, buffer } of decodedBuffers) {
      const duration = buffer.duration
      chapterTimings.push({
        id,
        title,
        startTime: totalDuration,
        endTime: totalDuration + duration,
        duration
      })
      totalDuration += duration
    }

    // Use first buffer's properties for output
    const sampleRate = decodedBuffers[0].buffer.sampleRate
    const numChannels = decodedBuffers[0].buffer.numberOfChannels
    const totalSamples = Math.ceil(totalDuration * sampleRate)

    // Create offline context for rendering
    const offlineContext = new OfflineAudioContext(
      numChannels,
      totalSamples,
      sampleRate
    )

    // Schedule all buffers sequentially
    let currentTime = 0
    for (const { buffer } of decodedBuffers) {
      const source = offlineContext.createBufferSource()
      source.buffer = buffer
      source.connect(offlineContext.destination)
      source.start(currentTime)
      currentTime += buffer.duration
    }

    // Render to combined buffer
    const renderedBuffer = await offlineContext.startRendering()

    // Encode to WAV
    const wavData = encodeWav(renderedBuffer)
    const blob = new Blob([wavData], { type: "audio/wav" })

    return {
      blob,
      duration: totalDuration,
      chapterTimings
    }
  } finally {
    await audioContext.close()
  }
}

/**
 * Downloads a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

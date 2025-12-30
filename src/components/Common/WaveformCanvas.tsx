import React from "react"

type WaveformCanvasProps = {
  stream?: MediaStream | null
  audioRef?: React.RefObject<HTMLAudioElement>
  active?: boolean
  label?: string
  height?: number
}

const getCanvasSize = (canvas: HTMLCanvasElement) => {
  const { width, height } = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  const w = Math.max(1, Math.floor(width * ratio))
  const h = Math.max(1, Math.floor(height * ratio))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  return { width: w, height: h, ratio }
}

const drawIdle = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height / 2)
  ctx.lineTo(width, height / 2)
  ctx.stroke()
}

const drawWaveform = (
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number
) => {
  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = 2
  ctx.strokeStyle = "rgba(34, 197, 94, 0.9)"
  ctx.beginPath()
  const sliceWidth = width / data.length
  let x = 0
  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128
    const y = (v * height) / 2
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    x += sliceWidth
  }
  ctx.lineTo(width, height / 2)
  ctx.stroke()
}

const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  stream,
  audioRef,
  active = false,
  label = "Waveform visualization",
  height = 72
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const ctxRef = React.useRef<AudioContext | null>(null)
  const mediaSourceRef = React.useRef<MediaElementAudioSourceNode | null>(null)
  const streamSourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null)

  const stopAnimation = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  React.useEffect(() => {
    return () => {
      stopAnimation()
      try {
        streamSourceRef.current?.disconnect()
      } catch {}
      try {
        mediaSourceRef.current?.disconnect()
      } catch {}
      try {
        analyserRef.current?.disconnect()
      } catch {}
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {})
      }
      streamSourceRef.current = null
      analyserRef.current = null
      ctxRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { width, height } = getCanvasSize(canvas)
    drawIdle(ctx, width, height)
  }, [])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    if (!active || (!stream && !audioRef?.current)) {
      stopAnimation()
      const { width, height } = getCanvasSize(canvas)
      drawIdle(ctx, width, height)
      return
    }

    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      ctxRef.current = new AudioCtx()
    }

    const audioContext = ctxRef.current
    if (!audioContext) return
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    analyserRef.current = analyser

    if (stream) {
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      streamSourceRef.current = source
    } else if (audioRef?.current) {
      const source =
        mediaSourceRef.current || audioContext.createMediaElementSource(audioRef.current)
      mediaSourceRef.current = source
      source.connect(analyser)
      analyser.connect(audioContext.destination)
    }

    const data = new Uint8Array(analyser.frequencyBinCount)

    const draw = () => {
      if (!analyserRef.current || !canvasRef.current) return
      const { width, height } = getCanvasSize(canvasRef.current)
      analyserRef.current.getByteTimeDomainData(data)
      drawWaveform(ctx, data, width, height)
      rafRef.current = requestAnimationFrame(draw)
    }

    audioContext.resume().catch(() => {})
    draw()

    return () => {
      stopAnimation()
      try {
        streamSourceRef.current?.disconnect()
      } catch {}
      try {
        mediaSourceRef.current?.disconnect()
      } catch {}
      try {
        analyser.disconnect()
      } catch {}
      analyserRef.current = null
      streamSourceRef.current = null
    }
  }, [active, stream, audioRef])

  return (
    <div className="w-full" role="img" aria-label={label}>
      <canvas
        ref={canvasRef}
        className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-900/40"
        style={{ height }}
      />
    </div>
  )
}

export default WaveformCanvas

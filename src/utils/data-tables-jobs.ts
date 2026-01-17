import type { ApiDataTableJobStatus } from "@/services/tldw/data-tables"

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    if (!signal) return
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error("Polling cancelled"))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })

export const pollDataTableJob = async ({
  jobId,
  fetchJob,
  signal,
  intervalMs = 1000,
  timeoutMs = 5 * 60 * 1000
}: {
  jobId: number
  fetchJob: (jobId: number) => Promise<ApiDataTableJobStatus>
  signal?: AbortSignal
  intervalMs?: number
  timeoutMs?: number
}): Promise<ApiDataTableJobStatus> => {
  const start = Date.now()
  while (true) {
    if (signal?.aborted) {
      throw new Error("Polling cancelled")
    }
    const status = await fetchJob(jobId)
    const state = String(status?.status || "").toLowerCase()
    if (state && ["completed", "failed", "cancelled"].includes(state)) {
      return status
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Job timed out")
    }
    await sleep(intervalMs, signal)
  }
}

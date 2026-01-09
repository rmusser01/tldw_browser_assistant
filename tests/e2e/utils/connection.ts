import type { Page } from '@playwright/test'

// Small helpers to interact with the shared connection store from Playwright
// tests. These avoid duplicating inline evaluate blocks and provide consistent
// debug logging for flaky connection‑dependent specs.

export async function waitForConnectionStore(page: Page, label = 'init') {
  const waitForAppReady = async (timeoutMs: number) => {
    await page.waitForFunction(
      () => {
        const root = document.querySelector('#root')
        if (!root) return false
        return document.readyState !== 'loading'
      },
      null,
      { timeout: timeoutMs }
    )
  }

  await page.waitForLoadState('domcontentloaded')
  const root = page.locator('#root')
  try {
    await root.waitFor({ state: 'attached', timeout: 15_000 })
  } catch {
    // ignore if root takes longer to mount; store check will retry
  }

  try {
    await waitForAppReady(15_000)
  } catch {
    // One retry after a hard reload in case the extension page failed to boot.
    await page.reload({ waitUntil: 'domcontentloaded' })
    try {
      await root.waitFor({ state: 'attached', timeout: 15_000 })
    } catch {
      // ignore; waitForStore will still time out if app never mounts
    }
    await waitForAppReady(20_000)
  }
  await logConnectionSnapshot(page, label)
}

export async function logConnectionSnapshot(page: Page, label: string) {
  await page.evaluate((tag) => {
    const root = document.querySelector('#root')
    const w: any = window as any
    const store = w.__tldw_useConnectionStore
    if (!store?.getState) {
      // eslint-disable-next-line no-console
      console.log('CONNECTION_DEBUG', tag, JSON.stringify({
        storeReady: false,
        rootReady: !!root,
        rootChildren: root ? root.children.length : 0,
        readyState: document.readyState
      }))
      return
    }
    try {
      const state = store.getState().state
      // eslint-disable-next-line no-console
      console.log('CONNECTION_DEBUG', tag, JSON.stringify({
        phase: state.phase,
        configStep: state.configStep,
        mode: state.mode,
        errorKind: state.errorKind,
        serverUrl: state.serverUrl,
        isConnected: state.isConnected,
        isChecking: state.isChecking,
        knowledgeStatus: state.knowledgeStatus,
        hasCompletedFirstRun: state.hasCompletedFirstRun
      }))
    } catch {
      // ignore snapshot failures
    }
  }, label)
}

export async function forceConnectionState(
  page: Page,
  patch: Record<string, unknown>,
  label = 'forceConnectionState'
) {
  await page.evaluate(
    ({ patchInner, tag }) => {
      const w: any = window as any
      const store = w.__tldw_useConnectionStore
      if (!store?.getState || !store?.setState) {
        // eslint-disable-next-line no-console
        console.log('CONNECTION_DEBUG_APPLY', tag, JSON.stringify({ storeReady: false }))
        return
      }
      const prev = store.getState().state
      const next = {
        ...prev,
        ...patchInner
      }
      store.setState({ state: next })
      // eslint-disable-next-line no-console
      console.log('CONNECTION_DEBUG_APPLY', tag, JSON.stringify({
        phase: next.phase,
        configStep: next.configStep,
        mode: next.mode,
        errorKind: next.errorKind,
        serverUrl: next.serverUrl,
        isConnected: next.isConnected,
        isChecking: next.isChecking,
        knowledgeStatus: next.knowledgeStatus,
        hasCompletedFirstRun: next.hasCompletedFirstRun
      }))
    },
    { patchInner: patch, tag: label }
  )
}

export async function forceConnected(
  page: Page,
  overrides: Record<string, unknown> = {},
  label = 'forceConnected'
) {
  const now = Date.now()
  await forceConnectionState(
    page,
    {
      phase: 'connected',
      isConnected: true,
      isChecking: false,
      offlineBypass: true,
      errorKind: 'none',
      lastError: null,
      lastStatusCode: null,
      lastCheckedAt: now,
      knowledgeStatus: 'ready',
      knowledgeLastCheckedAt: now,
      knowledgeError: null,
      mode: 'normal',
      configStep: 'health',
      hasCompletedFirstRun: true,
      ...overrides
    },
    label
  )
}

export async function forceUnconfigured(
  page: Page,
  label = 'forceUnconfigured'
) {
  await forceConnectionState(
    page,
    {
      phase: 'unconfigured',
      isConnected: false,
      isChecking: false,
      offlineBypass: false,
      errorKind: 'none',
      knowledgeStatus: 'unknown',
      knowledgeLastCheckedAt: null,
      knowledgeError: null,
      mode: 'normal',
      configStep: 'url',
      hasCompletedFirstRun: false
    },
    label
  )
}

export async function forceErrorUnreachable(
  page: Page,
  overrides: Record<string, unknown> = {},
  label = 'forceErrorUnreachable'
) {
  const now = Date.now()
  await forceConnectionState(
    page,
    {
      phase: 'error',
      isConnected: false,
      isChecking: false,
      offlineBypass: false,
      errorKind: 'unreachable',
      lastError: 'forced-unreachable',
      lastStatusCode: 0,
      lastCheckedAt: now,
      knowledgeStatus: 'offline',
      knowledgeLastCheckedAt: now,
      knowledgeError: 'core-offline',
      mode: 'normal',
      configStep: 'health',
      ...overrides
    },
    label
  )
}

/**
 * Set the selected model via chrome.storage.sync.
 * Plasmo's useStorage defaults to sync area, so we must use sync not local.
 * Must be called and awaited before React components mount.
 */
export async function setSelectedModel(page: Page, model: string) {
  // Set via chrome.storage.sync (what Plasmo useStorage reads by default)
  await page.evaluate(
    async ({ modelId, timeoutMs, intervalMs }) => {
      const w: any = window as any
      // @ts-ignore
      const hasSync =
        w?.chrome?.storage?.sync?.set && w?.chrome?.storage?.sync?.get
      // @ts-ignore
      const hasLocal =
        w?.chrome?.storage?.local?.set && w?.chrome?.storage?.local?.get

      // @ts-ignore - Plasmo useStorage defaults to sync area
      const storageArea = hasSync
        ? // @ts-ignore
          w.chrome.storage.sync
        : hasLocal
          ? // @ts-ignore
            w.chrome.storage.local
          : null

      if (!storageArea) {
        // eslint-disable-next-line no-console
        console.warn('MODEL_DEBUG: No chrome.storage available, skipping')
        return
      }

      const setValue = (
        area: typeof chrome.storage.local | typeof chrome.storage.sync,
        items: Record<string, unknown>
      ) =>
        new Promise<void>((resolve, reject) => {
          area.set(items, () => {
            // @ts-ignore
            const err = w?.chrome?.runtime?.lastError
            if (err) reject(err)
            else resolve()
          })
        })

      const getValue = (
        area: typeof chrome.storage.local | typeof chrome.storage.sync,
        keys: string[]
      ) =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          area.get(keys, (items: Record<string, unknown>) => {
            // @ts-ignore
            const err = w?.chrome?.runtime?.lastError
            if (err) reject(err)
            else resolve(items)
          })
        })

      const normalizeStoredValue = (value: unknown) => {
        if (typeof value !== "string") return value
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }

      try {
        const serialized = JSON.stringify(modelId)
        if (hasSync && hasLocal) {
          await setValue(w.chrome.storage.sync, { selectedModel: serialized })
          await setValue(w.chrome.storage.local, { selectedModel: serialized })
        } else if (storageArea) {
          await setValue(storageArea, { selectedModel: serialized })
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('MODEL_DEBUG: Failed to set selectedModel', error)
        return
      }

      const startedAt = Date.now()
      let lastRead: unknown = undefined
      while (Date.now() - startedAt < timeoutMs) {
        try {
          const data = await getValue(storageArea, ['selectedModel'])
          lastRead = normalizeStoredValue(data?.selectedModel)
          if (lastRead === modelId) {
            // eslint-disable-next-line no-console
            console.log(
              'MODEL_DEBUG: Confirmed selectedModel stored as',
              modelId
            )
            return
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('MODEL_DEBUG: Failed to read back selectedModel', error)
          return
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, intervalMs)
        })
      }

      // eslint-disable-next-line no-console
      console.warn('MODEL_DEBUG: Timed out waiting for selectedModel', {
        expected: modelId,
        actual: lastRead
      })
    },
    { modelId: model, timeoutMs: 3_000, intervalMs: 50 }
  )
}

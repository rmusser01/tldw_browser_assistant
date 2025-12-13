import type { Page } from "@playwright/test"

type SyntheticMessageInjectionResult = { ok: boolean; reason?: string }

export async function injectSyntheticMessages(
  page: Page,
  count: number
): Promise<SyntheticMessageInjectionResult> {
  if (!Number.isFinite(count) || count < 0) {
    return { ok: false, reason: "count must be a finite, non-negative number" }
  }
  return page.evaluate((cnt) => {
    try {
      const store = (window as any).__tldw_useQuickChatStore?.getState?.()
      if (!store?.addMessage) {
        return {
          ok: false,
          reason:
            "Synthetic injection unavailable: window.__tldw_useQuickChatStore.getState().addMessage is not exposed"
        }
      }

      const n = Math.max(0, Math.floor(cnt))
      for (let i = 0; i < n; i++) {
        const role = i % 2 === 0 ? "user" : "assistant"
        const content =
          role === "user"
            ? `Test message ${i}: synthetic-user-content-${i}`
            : `Response ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. ` +
              `Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
              `Message number ${i} with some additional content to make it realistic.`
        store.addMessage(role, content)
      }

      return { ok: true }
    } catch (e) {
      return { ok: false, reason: `Synthetic injection failed: ${String(e)}` }
    }
  }, count)
}

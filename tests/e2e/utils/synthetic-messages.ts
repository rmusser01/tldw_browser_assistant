import type { Page } from "@playwright/test"

type SyntheticMessageInjectionResult = { ok: boolean; reason?: string }

const MAX_SYNTHETIC_MESSAGES = 5_000

export async function injectSyntheticMessages(
  page: Page,
  count: number
): Promise<SyntheticMessageInjectionResult> {
  if (!Number.isFinite(count) || count < 0) {
    return { ok: false, reason: "count must be a finite, non-negative number" }
  }
  if (!Number.isInteger(count)) {
    return { ok: false, reason: "count must be a non-negative integer" }
  }
  if (count > MAX_SYNTHETIC_MESSAGES) {
    return {
      ok: false,
      reason: `count must be <= ${MAX_SYNTHETIC_MESSAGES} to avoid freezing the page`
    }
  }

  return page.evaluate<SyntheticMessageInjectionResult, number>((cnt) => {
    try {
      const store = (window as any).__tldw_useQuickChatStore?.getState?.()
      if (!store?.addMessage) {
        return {
          ok: false,
          reason:
            "Synthetic injection unavailable: window.__tldw_useQuickChatStore.getState().addMessage is not exposed"
        }
      }

      for (let i = 0; i < cnt; i++) {
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

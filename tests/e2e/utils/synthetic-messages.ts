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
      const pageAssist = (window as any).__tldw_pageAssist
      if (pageAssist?.setMessages) {
        const messages = []
        for (let i = 0; i < cnt; i++) {
          const isBot = i % 2 !== 0
          const message = isBot
            ? `Response ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. ` +
              `Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
              `Message number ${i} with some additional content to make it realistic.`
            : `Test message ${i}: synthetic-user-content-${i}`
          messages.push({
            id: `synthetic-${i}`,
            isBot,
            name: isBot ? "Assistant" : "User",
            message,
            sources: []
          })
        }
        pageAssist.setMessages(messages)
        return { ok: true }
      }

      const quickStore = (window as any).__tldw_useQuickChatStore?.getState?.()
      if (quickStore?.addMessage) {
        for (let i = 0; i < cnt; i++) {
          const role = i % 2 === 0 ? "user" : "assistant"
          const content =
            role === "user"
              ? `Test message ${i}: synthetic-user-content-${i}`
              : `Response ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. ` +
                `Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
                `Message number ${i} with some additional content to make it realistic.`
          quickStore.addMessage(role, content)
        }
        return { ok: true }
      }

      const optionStore = (window as any).__tldw_useStoreMessageOption?.getState?.()
      if (optionStore?.setMessages) {
        const messages = []
        for (let i = 0; i < cnt; i++) {
          const isBot = i % 2 !== 0
          const message = isBot
            ? `Response ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. ` +
              `Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
              `Message number ${i} with some additional content to make it realistic.`
            : `Test message ${i}: synthetic-user-content-${i}`
          messages.push({
            id: `synthetic-${i}`,
            isBot,
            name: isBot ? "Assistant" : "User",
            message,
            sources: []
          })
        }
        optionStore.setMessages(messages)
        optionStore.setIsFirstMessage?.(false)
        return { ok: true }
      }

      return {
        ok: false,
        reason:
          "Synthetic injection unavailable: no exposed chat store with addMessage/setMessages"
      }
    } catch (e) {
      return { ok: false, reason: `Synthetic injection failed: ${String(e)}` }
    }
  }, count)
}

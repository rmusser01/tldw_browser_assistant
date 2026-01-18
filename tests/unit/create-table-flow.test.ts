import { describe, expect, test } from "bun:test"

import { startCreateTableFromChat } from "../../src/utils/data-tables-create-flow"

describe("create table flow from chat", () => {
  test("navigates in-app when options page and navigation are available", async () => {
    const calls = {
      reset: 0,
      addSource: [] as Array<Record<string, unknown>>,
      setStep: [] as string[],
      navigate: [] as string[],
      prefill: [] as Array<Record<string, unknown>>,
      open: 0
    }

    await startCreateTableFromChat(
      { id: "chat-1", title: "My Chat", topic_label: "Topic" },
      {
        isOptionsPage: true,
        navigate: (path) => calls.navigate.push(path),
        resetWizard: () => {
          calls.reset += 1
        },
        addSource: (source) => calls.addSource.push(source),
        setWizardStep: (step) => calls.setStep.push(step),
        queuePrefill: async (payload) => {
          calls.prefill.push(payload)
        },
        openOptionsPage: () => {
          calls.open += 1
        }
      }
    )

    expect(calls.reset).toBe(1)
    expect(calls.addSource).toEqual([
      {
        type: "chat",
        id: "chat-1",
        title: "My Chat",
        snippet: "Topic"
      }
    ])
    expect(calls.setStep).toEqual(["prompt"])
    expect(calls.navigate).toEqual(["/data-tables"])
    expect(calls.prefill).toEqual([])
    expect(calls.open).toBe(0)
  })

  test("falls back to prefill when options page lacks navigation hook", async () => {
    const calls = {
      reset: 0,
      addSource: [] as Array<Record<string, unknown>>,
      setStep: [] as string[],
      navigate: [] as string[],
      prefill: [] as Array<Record<string, unknown>>,
      open: 0
    }

    await startCreateTableFromChat(
      { id: "chat-2", title: "", topic_label: null },
      {
        isOptionsPage: true,
        navigate: undefined,
        resetWizard: () => {
          calls.reset += 1
        },
        addSource: (source) => calls.addSource.push(source),
        setWizardStep: (step) => calls.setStep.push(step),
        queuePrefill: async (payload) => {
          calls.prefill.push(payload)
        },
        openOptionsPage: () => {
          calls.open += 1
        }
      }
    )

    expect(calls.reset).toBe(1)
    expect(calls.addSource).toEqual([
      {
        type: "chat",
        id: "chat-2",
        title: "Chat chat-2",
        snippet: undefined
      }
    ])
    expect(calls.setStep).toEqual(["prompt"])
    expect(calls.navigate).toEqual([])
    expect(calls.prefill).toEqual([
      {
        kind: "chat",
        source: {
          type: "chat",
          id: "chat-2",
          title: "Chat chat-2",
          snippet: undefined
        }
      }
    ])
    expect(calls.open).toBe(1)
  })

  test("prefills and opens options from non-options pages", async () => {
    const calls = {
      reset: 0,
      addSource: [] as Array<Record<string, unknown>>,
      setStep: [] as string[],
      navigate: [] as string[],
      prefill: [] as Array<Record<string, unknown>>,
      open: 0
    }

    await startCreateTableFromChat(
      { id: "chat-3", title: "Another Chat", topic_label: undefined },
      {
        isOptionsPage: false,
        navigate: (path) => calls.navigate.push(path),
        resetWizard: () => {
          calls.reset += 1
        },
        addSource: (source) => calls.addSource.push(source),
        setWizardStep: (step) => calls.setStep.push(step),
        queuePrefill: async (payload) => {
          calls.prefill.push(payload)
        },
        openOptionsPage: () => {
          calls.open += 1
        }
      }
    )

    expect(calls.reset).toBe(0)
    expect(calls.addSource).toEqual([])
    expect(calls.setStep).toEqual([])
    expect(calls.navigate).toEqual([])
    expect(calls.prefill).toEqual([
      {
        kind: "chat",
        source: {
          type: "chat",
          id: "chat-3",
          title: "Another Chat",
          snippet: undefined
        }
      }
    ])
    expect(calls.open).toBe(1)
  })
})

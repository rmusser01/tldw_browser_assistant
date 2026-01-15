import { describe, expect, test } from "bun:test"
import type { KeyboardEvent } from "react"
import { handleQueuedRowKeyDown } from "../../src/components/Common/QuickIngest/queued-row-keydown"

const makeEvent = (key: string) => {
  let prevented = false
  const event = {
    key,
    preventDefault: () => {
      prevented = true
    }
  } as unknown as KeyboardEvent<HTMLElement>

  return { event, prevented: () => prevented }
}

describe("handleQueuedRowKeyDown", () => {
  test("triggers selection on Enter", () => {
    let called = 0
    const onSelect = () => {
      called += 1
    }
    const { event, prevented } = makeEvent("Enter")

    handleQueuedRowKeyDown(event, onSelect)

    expect(called).toBe(1)
    expect(prevented()).toBe(true)
  })

  test("triggers selection on Space", () => {
    let called = 0
    const onSelect = () => {
      called += 1
    }
    const { event, prevented } = makeEvent(" ")

    handleQueuedRowKeyDown(event, onSelect)

    expect(called).toBe(1)
    expect(prevented()).toBe(true)
  })

  test("ignores other keys", () => {
    let called = 0
    const onSelect = () => {
      called += 1
    }
    const { event, prevented } = makeEvent("Escape")

    handleQueuedRowKeyDown(event, onSelect)

    expect(called).toBe(0)
    expect(prevented()).toBe(false)
  })
})

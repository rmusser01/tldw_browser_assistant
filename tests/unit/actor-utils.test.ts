import { describe, expect, test } from "bun:test"
import {
  createDefaultActorSettings,
  normalizeActorAspectKey
} from "../../src/types/actor"
import { buildActorDictionaryTokens, buildActorPrompt } from "../../src/utils/actor"

describe("normalizeActorAspectKey", () => {
  test("adds target prefix when missing", () => {
    expect(
      normalizeActorAspectKey({
        raw: "role",
        target: "user"
      })
    ).toBe("user_role")
  })

  test("keeps matching target prefix", () => {
    expect(
      normalizeActorAspectKey({
        raw: "user_role",
        target: "user"
      })
    ).toBe("user_role")
  })

  test("replaces mismatched target prefix", () => {
    expect(
      normalizeActorAspectKey({
        raw: "world_role",
        target: "user"
      })
    ).toBe("user_role")
  })

  test("uses fallback when input is empty", () => {
    expect(
      normalizeActorAspectKey({
        raw: "",
        target: "user",
        fallback: "user_state"
      })
    ).toBe("user_state")
  })
})

describe("buildActorDictionaryTokens", () => {
  test("normalizes keys with target prefix", () => {
    const settings = createDefaultActorSettings()
    settings.aspects = [
      {
        id: "user_role",
        key: "role",
        target: "user",
        name: "Role",
        source: "free",
        value: "guide"
      }
    ]

    const tokens = buildActorDictionaryTokens(settings)

    expect(tokens).toEqual([
      {
        token: "[[actor_user_role]]",
        aspectId: "user_role",
        key: "user_role",
        target: "user",
        name: "Role",
        value: "guide"
      }
    ])
  })

  test("skips empty keys", () => {
    const settings = createDefaultActorSettings()
    settings.aspects = [
      {
        id: "user_role",
        key: "",
        target: "user",
        name: "Role",
        source: "free",
        value: "guide"
      }
    ]

    const tokens = buildActorDictionaryTokens(settings)

    expect(tokens).toEqual([])
  })
})

describe("buildActorPrompt", () => {
  test("omits GM-only notes from the prompt", () => {
    const settings = createDefaultActorSettings()
    settings.isEnabled = true
    settings.aspects = [
      {
        id: "user_role",
        key: "user_role",
        target: "user",
        name: "User role",
        source: "free",
        value: "mentor"
      }
    ]
    settings.notes = "Secret note"
    settings.notesGmOnly = true

    const prompt = buildActorPrompt(settings)

    expect(prompt).toContain("Scene information:")
    expect(prompt).not.toContain("Scene notes:")
  })
})

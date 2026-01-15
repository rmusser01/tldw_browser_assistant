import { describe, expect, test } from "bun:test"
import {
  configMatchesPreset,
  detectPreset,
  getPresetConfig
} from "../../src/components/Common/QuickIngest/presets"
import type { CommonOptions, TypeDefaults } from "../../src/components/Common/QuickIngest/types"

type PresetTestConfig = {
  common: CommonOptions
  storeRemote: boolean
  reviewBeforeStorage: boolean
  typeDefaults: TypeDefaults
}

const baseCommon: CommonOptions = {
  perform_analysis: true,
  perform_chunking: true,
  overwrite_existing: false
}

const baseTypeDefaults: TypeDefaults = {
  audio: { diarize: false },
  document: { ocr: true },
  video: { captions: true }
}

const mergeTypeDefaults = (
  base: TypeDefaults,
  overrides?: TypeDefaults
): TypeDefaults => ({
  ...base,
  audio: { ...base.audio, ...overrides?.audio },
  document: { ...base.document, ...overrides?.document },
  video: { ...base.video, ...overrides?.video }
})

const buildConfig = (
  overrides: Partial<PresetTestConfig> = {}
): PresetTestConfig => {
  const common = {
    ...baseCommon,
    ...(overrides.common ?? {})
  }
  const typeDefaults = mergeTypeDefaults(
    baseTypeDefaults,
    overrides.typeDefaults
  )
  return {
    common,
    storeRemote: overrides.storeRemote ?? true,
    reviewBeforeStorage: overrides.reviewBeforeStorage ?? false,
    typeDefaults
  }
}

describe("Quick Ingest presets", () => {
  test("configMatchesPreset returns true for Quick defaults", () => {
    const quickConfig: PresetTestConfig = {
      common: {
        perform_analysis: false,
        perform_chunking: false,
        overwrite_existing: false
      },
      storeRemote: true,
      reviewBeforeStorage: false,
      typeDefaults: {}
    }

    expect(configMatchesPreset(quickConfig, "quick")).toBe(true)
  })

  test("configMatchesPreset returns false when values differ", () => {
    const standardConfig = buildConfig({ reviewBeforeStorage: true })

    expect(configMatchesPreset(standardConfig, "standard")).toBe(false)
  })

  test("detectPreset identifies Standard", () => {
    const standardConfig = buildConfig()

    expect(detectPreset(standardConfig)).toBe("standard")
  })

  test("detectPreset returns custom for non-matching config", () => {
    const customConfig = buildConfig({ storeRemote: false })

    expect(detectPreset(customConfig)).toBe("custom")
  })

  test("getPresetConfig returns undefined for custom", () => {
    expect(getPresetConfig("custom")).toBeUndefined()
  })
})

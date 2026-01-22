import React from "react"
import {
  Button,
  Collapse,
  Input,
  InputNumber,
  Select,
  Tooltip
} from "antd"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useStorage } from "@plasmohq/storage/hook"
import { fetchImageModels } from "@/services/tldw-server"
import { getProviderDisplayName } from "@/utils/provider-registry"
import SettingRow from "@/components/Common/SettingRow"
import type {
  ImageBackendConfig,
  ImageBackendConfigMap,
  ImageOutputFormat
} from "@/services/image-generation"

const { Panel } = Collapse

type ImageBackendOption = { value: string; label: string; provider?: string }

const FORMAT_OPTIONS: Array<{ value: ImageOutputFormat; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPEG" },
  { value: "webp", label: "WebP" }
]

const normalizeNumberInput = (value: number | null): number | undefined =>
  value == null ? undefined : value

const updateConfigField = <K extends keyof ImageBackendConfig>(
  config: ImageBackendConfig,
  key: K,
  value: ImageBackendConfig[K]
): ImageBackendConfig => {
  const next: ImageBackendConfig = { ...config, [key]: value }
  if (value === undefined || value === "") {
    delete next[key]
  }
  return next
}

const pruneEmptyConfig = (config: ImageBackendConfig): ImageBackendConfig => {
  const next: ImageBackendConfig = { ...config }
  Object.entries(next).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      delete (next as Record<string, unknown>)[key]
    }
  })
  return next
}

export const ImageGenerationSettings = () => {
  const { t } = useTranslation(["settings", "playground", "common"])
  const [imageBackendDefault, setImageBackendDefault] = useStorage(
    "imageBackendDefault",
    ""
  )
  const [imageBackendConfigs, setImageBackendConfigs] =
    useStorage<ImageBackendConfigMap>("imageBackendConfigs", {})

  const { data: imageModels = [] } = useQuery({
    queryKey: ["settings:imageModels"],
    queryFn: () => fetchImageModels({ returnEmpty: true })
  })

  const backendOptions = React.useMemo<ImageBackendOption[]>(() => {
    const dynamicOptions = (imageModels || [])
      .filter((model: any) => model && model.id)
      .map((model: any) => ({
        value: String(model.id),
        label: String(model.name || model.id),
        provider: model.provider ? String(model.provider) : undefined
      }))

    const fallbackOptions = [
      {
        value: "tldw_server-Flux-Klein",
        label: t("playground:imageBackend.fluxKlein", "Flux-Klein")
      },
      {
        value: "tldw_server-ZTurbo",
        label: t("playground:imageBackend.zTurbo", "ZTurbo")
      }
    ]

    const baseOptions = dynamicOptions.length > 0 ? dynamicOptions : fallbackOptions
    return [
      {
        value: "",
        label: t("settings:imageGenerationSettings.noneOption", "None")
      },
      ...baseOptions
    ]
  }, [imageModels, t])

  const backendPanels = React.useMemo<ImageBackendOption[]>(
    () => backendOptions.filter((option) => option.value),
    [backendOptions]
  )

  const updateBackendConfig = React.useCallback(
    (backend: string, updater: (config: ImageBackendConfig) => ImageBackendConfig) => {
      setImageBackendConfigs((prev) => {
        const current = (prev && prev[backend]) || {}
        const updated = pruneEmptyConfig(updater(current))
        const nextMap = { ...(prev || {}) }
        if (Object.keys(updated).length === 0) {
          delete nextMap[backend]
        } else {
          nextMap[backend] = updated
        }
        return nextMap
      })
    },
    [setImageBackendConfigs]
  )

  const resetBackendConfig = React.useCallback(
    (backend: string) => {
      setImageBackendConfigs((prev) => {
        const next = { ...(prev || {}) }
        delete next[backend]
        return next
      })
    },
    [setImageBackendConfigs]
  )

  return (
    <div className="flex flex-col space-y-6 text-sm">
      <div>
        <h2 className="text-base font-semibold leading-7 text-text">
          {t("imageGenerationSettings.title", "Image generation")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t(
            "imageGenerationSettings.subtitle",
            "Configure image generation defaults for each backend and set your slash-command default."
          )}
        </p>
        <div className="border-b border-border mt-3" />
      </div>

      <div className="rounded-md border border-border bg-surface p-4 space-y-2">
        <SettingRow
          label={t(
            "imageGenerationSettings.defaultBackendLabel",
            "Default image backend"
          )}
          description={t(
            "imageGenerationSettings.defaultBackendHint",
            "Used when you run /generate-image without a provider override."
          )}
          control={
            <Select
              value={imageBackendDefault}
              onChange={(value) => setImageBackendDefault(value)}
              options={backendOptions.map((option) => ({
                value: option.value,
                label: option.provider
                  ? `${getProviderDisplayName(option.provider)} · ${option.label}`
                  : option.label
              }))}
              placeholder={t(
                "imageGenerationSettings.defaultBackendPlaceholder",
                "Select a backend"
              )}
              className="min-w-[220px]"
              aria-label={t(
                "imageGenerationSettings.defaultBackendLabel",
                "Default image backend"
              )}
            />
          }
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text">
              {t("imageGenerationSettings.backendSectionTitle", "Backend presets")}
            </h3>
            <p className="text-xs text-text-muted">
              {t(
                "imageGenerationSettings.backendSectionHint",
                "These settings are sent with your prompt. Leave fields blank to use server defaults."
              )}
            </p>
          </div>
        </div>

        {backendPanels.length === 0 ? (
          <div className="rounded-md border border-border bg-surface p-4 text-sm text-text-muted">
            {t(
              "imageGenerationSettings.noBackends",
              "No image backends detected from the server yet."
            )}
          </div>
        ) : (
          <Collapse accordion>
            {backendPanels.map((option) => {
              const backend = option.value
              const config = imageBackendConfigs?.[backend] || {}
              const providerLabel = option.provider
                ? getProviderDisplayName(option.provider)
                : null
              const panelLabel = providerLabel
                ? `${providerLabel} · ${option.label}`
                : option.label
              return (
                <Panel header={panelLabel} key={backend}>
                  <div className="space-y-2">
                    <SettingRow
                      label={t(
                        "imageGenerationSettings.formatLabel",
                        "Output format"
                      )}
                      description={t(
                        "imageGenerationSettings.formatHint",
                        "PNG is safest for most models."
                      )}
                      control={
                        <Select
                          value={config.format || "png"}
                          options={FORMAT_OPTIONS.map((item) => ({
                            value: item.value,
                            label: t(
                              `imageGenerationSettings.format.${item.value}`,
                              item.label
                            )
                          }))}
                          onChange={(value) =>
                            updateBackendConfig(backend, (prev) =>
                              updateConfigField(prev, "format", value)
                            )
                          }
                          className="min-w-[160px]"
                        />
                      }
                    />

                    <SettingRow
                      label={t(
                        "imageGenerationSettings.negativePromptLabel",
                        "Negative prompt"
                      )}
                      description={t(
                        "imageGenerationSettings.negativePromptHint",
                        "Optional text to steer the model away from elements."
                      )}
                      control={
                        <Input
                          value={config.negativePrompt || ""}
                          onChange={(event) =>
                            updateBackendConfig(backend, (prev) =>
                              updateConfigField(
                                prev,
                                "negativePrompt",
                                event.target.value
                              )
                            )
                          }
                          placeholder={t(
                            "imageGenerationSettings.negativePromptPlaceholder",
                            "e.g., blurry, low-res"
                          )}
                        />
                      }
                    />

                    <div className="grid gap-2 md:grid-cols-2">
                      <SettingRow
                        label={t("imageGenerationSettings.widthLabel", "Width")}
                        control={
                          <InputNumber
                            value={config.width}
                            onChange={(value) =>
                              updateBackendConfig(backend, (prev) =>
                                updateConfigField(
                                  prev,
                                  "width",
                                  normalizeNumberInput(value)
                                )
                              )
                            }
                            min={64}
                            step={64}
                            className="w-full"
                          />
                        }
                      />
                      <SettingRow
                        label={t("imageGenerationSettings.heightLabel", "Height")}
                        control={
                          <InputNumber
                            value={config.height}
                            onChange={(value) =>
                              updateBackendConfig(backend, (prev) =>
                                updateConfigField(
                                  prev,
                                  "height",
                                  normalizeNumberInput(value)
                                )
                              )
                            }
                            min={64}
                            step={64}
                            className="w-full"
                          />
                        }
                      />
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <SettingRow
                        label={t("imageGenerationSettings.stepsLabel", "Steps")}
                        control={
                          <InputNumber
                            value={config.steps}
                            onChange={(value) =>
                              updateBackendConfig(backend, (prev) =>
                                updateConfigField(
                                  prev,
                                  "steps",
                                  normalizeNumberInput(value)
                                )
                              )
                            }
                            min={1}
                            max={250}
                            className="w-full"
                          />
                        }
                      />
                      <SettingRow
                        label={t(
                          "imageGenerationSettings.cfgScaleLabel",
                          "CFG scale"
                        )}
                        control={
                          <InputNumber
                            value={config.cfgScale}
                            onChange={(value) =>
                              updateBackendConfig(backend, (prev) =>
                                updateConfigField(
                                  prev,
                                  "cfgScale",
                                  normalizeNumberInput(value)
                                )
                              )
                            }
                            min={0}
                            step={0.5}
                            className="w-full"
                          />
                        }
                      />
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <SettingRow
                        label={t("imageGenerationSettings.seedLabel", "Seed")}
                        description={t(
                          "imageGenerationSettings.seedHint",
                          "Set to -1 or leave blank for random."
                        )}
                        control={
                          <InputNumber
                            value={config.seed}
                            onChange={(value) =>
                              updateBackendConfig(backend, (prev) =>
                                updateConfigField(
                                  prev,
                                  "seed",
                                  normalizeNumberInput(value)
                                )
                              )
                            }
                            min={-1}
                            className="w-full"
                          />
                        }
                      />
                      <SettingRow
                        label={t(
                          "imageGenerationSettings.samplerLabel",
                          "Sampler"
                        )}
                        control={
                          <Input
                            value={config.sampler || ""}
                            onChange={(event) =>
                              updateBackendConfig(backend, (prev) =>
                                updateConfigField(
                                  prev,
                                  "sampler",
                                  event.target.value
                                )
                              )
                            }
                            placeholder={t(
                              "imageGenerationSettings.samplerPlaceholder",
                              "e.g., euler_a"
                            )}
                          />
                        }
                      />
                    </div>

                    <SettingRow
                      label={t(
                        "imageGenerationSettings.modelLabel",
                        "Model override"
                      )}
                      description={t(
                        "imageGenerationSettings.modelHint",
                        "Optional model identifier/path supported by the backend."
                      )}
                      control={
                        <Input
                          value={config.model || ""}
                          onChange={(event) =>
                            updateBackendConfig(backend, (prev) =>
                              updateConfigField(prev, "model", event.target.value)
                            )
                          }
                          placeholder={t(
                            "imageGenerationSettings.modelPlaceholder",
                            "Leave blank to use server default"
                          )}
                        />
                      }
                    />

                    <SettingRow
                      label={t(
                        "imageGenerationSettings.extraParamsLabel",
                        "Extra params (JSON)"
                      )}
                      description={t(
                        "imageGenerationSettings.extraParamsHint",
                        "Optional backend-specific parameters. Invalid JSON will be ignored; keys must be allowlisted on the server."
                      )}
                      control={
                        <Input.TextArea
                          value={
                            typeof config.extraParams === "string"
                              ? config.extraParams
                              : config.extraParams
                                ? JSON.stringify(config.extraParams, null, 2)
                                : ""
                          }
                          onChange={(event) =>
                            updateBackendConfig(backend, (prev) =>
                              updateConfigField(
                                prev,
                                "extraParams",
                                event.target.value
                              )
                            )
                          }
                          rows={4}
                          placeholder={
                            '{"cli_args": ["--foo", "bar"], "guidance": 2.5}'
                          }
                        />
                      }
                    />

                    <div className="flex items-center justify-between pt-2">
                      <Tooltip
                        title={t(
                          "imageGenerationSettings.resetBackendHint",
                          "Clear all saved defaults for this backend."
                        )}
                      >
                        <Button size="small" onClick={() => resetBackendConfig(backend)}>
                          {t(
                            "imageGenerationSettings.resetBackend",
                            "Reset backend defaults"
                          )}
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </Panel>
              )
            })}
          </Collapse>
        )}
      </div>
    </div>
  )
}

export default ImageGenerationSettings

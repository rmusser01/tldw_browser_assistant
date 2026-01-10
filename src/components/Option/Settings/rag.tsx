import React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Avatar, Form, Input, InputNumber, Select, Skeleton } from "antd"
import { RobotOutlined } from "@ant-design/icons"
import { SaveButton } from "~/components/Common/SaveButton"
import {
  defaultEmbeddingChunkOverlap,
  defaultEmbeddingChunkSize,
  defaultEmbeddingModelForRag,
  defaultSplittingStrategy,
  defaultSplittingSeparator,
  getEmbeddingModels,
  saveForRag
} from "~/services/tldw-server"
import { SettingPrompt } from "./prompt"
import { useTranslation } from "react-i18next"
import { getNoOfRetrievedDocs, getTotalFilePerKB } from "@/services/app"
import { SidepanelRag } from "./sidepanel-rag"
import { ProviderIcons } from "@/components/Common/ProviderIcon"

const VALIDATION_RANGES = {
  chunkSize: { min: 100, max: 10000 },
  chunkOverlap: { min: 0, max: 1000 },
  noOfRetrievedDocs: { min: 1, max: 50 },
  totalFilePerKB: { min: 1 }
} as const

export const RagSettings = () => {
  const { t } = useTranslation("settings")
  const [form] = Form.useForm()
  const splittingStrategy = Form.useWatch("splittingStrategy", form)
  const queryClient = useQueryClient()
  const [failedAvatars, setFailedAvatars] = React.useState<Set<string>>(new Set())
  const [isFormValid, setIsFormValid] = React.useState(false)

  const updateFormValidity = React.useCallback(() => {
    const values = form.getFieldsValue()
    const hasErrors = form.getFieldsError().some((field) => field.errors.length > 0)

    const isNonEmptyString = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0
    const isValidNumber = (value: unknown, min: number, max?: number) =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= min &&
      (max == null || value <= max)

    const isMissingRequired =
      !isNonEmptyString(values.defaultEM) ||
      !isNonEmptyString(values.splittingStrategy) ||
      !isValidNumber(
        values.chunkSize,
        VALIDATION_RANGES.chunkSize.min,
        VALIDATION_RANGES.chunkSize.max
      ) ||
      !isValidNumber(
        values.chunkOverlap,
        VALIDATION_RANGES.chunkOverlap.min,
        VALIDATION_RANGES.chunkOverlap.max
      ) ||
      !isValidNumber(
        values.noOfRetrievedDocs,
        VALIDATION_RANGES.noOfRetrievedDocs.min,
        VALIDATION_RANGES.noOfRetrievedDocs.max
      ) ||
      !isValidNumber(values.totalFilePerKB, VALIDATION_RANGES.totalFilePerKB.min)

    const needsSeparator = values.splittingStrategy !== "RecursiveCharacterTextSplitter"
    const separatorMissing =
      needsSeparator && !isNonEmptyString(values.splittingSeparator)

    setIsFormValid(!hasErrors && !isMissingRequired && !separatorMissing)
  }, [form])

  const { data: ollamaInfo, status } = useQuery({
    queryKey: ["fetchRAGSettings"],
    queryFn: async () => {
      const [
        allModels,
        chunkOverlap,
        chunkSize,
        defaultEM,
        totalFilePerKB,
        noOfRetrievedDocs,
        splittingStrategy,
        splittingSeparator
      ] = await Promise.all([
        getEmbeddingModels(),
        defaultEmbeddingChunkOverlap(),
        defaultEmbeddingChunkSize(),
        defaultEmbeddingModelForRag(),
        getTotalFilePerKB(),
        getNoOfRetrievedDocs(),
        defaultSplittingStrategy(),
        defaultSplittingSeparator()
      ])
      return {
        models: allModels,
        chunkOverlap,
        chunkSize,
        defaultEM,
        totalFilePerKB,
        noOfRetrievedDocs,
        splittingStrategy,
        splittingSeparator
      }
    }
  })

  const { mutate: saveRAG, isPending: isSaveRAGPending } = useMutation({
    mutationFn: async (data: {
      model: string
      chunkSize: number
      overlap: number
      totalFilePerKB: number
      noOfRetrievedDocs: number
      strategy: string
      separator: string
    }) => {
      await saveForRag(
        data.model,
        data.chunkSize,
        data.overlap,
        data.totalFilePerKB,
        data.noOfRetrievedDocs,
        data.strategy,
        data.separator
      )
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["fetchRAGSettings"]
      })
    }
  })

  const missingDefaultEmbedding =
    !!ollamaInfo?.defaultEM &&
    Array.isArray(ollamaInfo?.models) &&
    !ollamaInfo.models.some((model) => model.model === ollamaInfo.defaultEM)

  // Validate form on initial load
  React.useEffect(() => {
    if (status === "success") {
      updateFormValidity()
    }
  }, [status, updateFormValidity])

  return (
    <div className="flex flex-col space-y-3">
      {status === "pending" && <Skeleton paragraph={{ rows: 4 }} active />}
      {status === "success" && (
        <div className="flex flex-col space-y-6">
          <div>
            <div>
              <h2 className="text-base font-semibold leading-7 text-text">
                {t("rag.ragSettings.label")}
              </h2>
              <div className="border-b border-border mt-3 mb-6"></div>
            </div>
            <Form
              form={form}
              layout="vertical"
              onFinish={(data) => {
                saveRAG({
                  model: data.defaultEM,
                  chunkSize: data.chunkSize,
                  overlap: data.chunkOverlap,
                  totalFilePerKB: data.totalFilePerKB,
                  noOfRetrievedDocs: data.noOfRetrievedDocs,
                  separator: data.splittingSeparator,
                  strategy: data.splittingStrategy
                })
              }}
              onValuesChange={() => {
                updateFormValidity()
              }}
              initialValues={{
                chunkSize: ollamaInfo?.chunkSize,
                chunkOverlap: ollamaInfo?.chunkOverlap,
                defaultEM: ollamaInfo?.defaultEM,
                totalFilePerKB: ollamaInfo?.totalFilePerKB,
                noOfRetrievedDocs: ollamaInfo?.noOfRetrievedDocs,
                splittingStrategy: ollamaInfo?.splittingStrategy,
                splittingSeparator: ollamaInfo?.splittingSeparator
              }}>
              <Form.Item
                name="defaultEM"
                label={t("rag.ragSettings.model.label")}
                help={
                  missingDefaultEmbedding
                    ? t(
                        "rag.ragSettings.model.helpMissing",
                        "Previously saved embedding model is no longer available on the server. Please choose another model."
                      )
                    : ollamaInfo?.defaultEM
                        ? t(
                            "rag.ragSettings.model.helpRecommended",
                            "Recommended: {{model}} (from server config)",
                            { model: ollamaInfo.defaultEM }
                          )
                        : t("rag.ragSettings.model.help")
                }
                rules={[
                  {
                    required: true,
                    message: t("rag.ragSettings.model.required")
                  }
                ]}>
                <Select
                  size="large"
                  showSearch
                  placeholder={t("rag.ragSettings.model.placeholder")}
                  style={{ width: "100%" }}
                  className="mt-4"
                  filterOption={(input, option) =>
                    option.label.key
                      .toLowerCase()
                      .indexOf(input.toLowerCase()) >= 0
                  }
                  options={ollamaInfo.models?.map((model) => ({
                    label: (
                      <span
                        key={model.model}
                        className="flex flex-row gap-3 items-center truncate">
                        {model?.avatar && !failedAvatars.has(model.model) ? (
                          <Avatar
                            src={model.avatar}
                            alt={model.name}
                            size="small"
                            onError={() => {
                              setFailedAvatars(prev => new Set(prev).add(model.model))
                              return false
                            }}
                          />
                        ) : (
                          model?.avatar && failedAvatars.has(model.model) ? (
                            <Avatar
                              size="small"
                              icon={<RobotOutlined />}
                            />
                          ) : (
                            <ProviderIcons
                              provider={model?.provider}
                              className="w-5 h-5"
                            />
                          )
                        )}
                        <span className="truncate">
                          {model?.nickname || model?.name}
                        </span>
                      </span>
                    ),
                    value: model.model
                  }))}
                />
              </Form.Item>

              <Form.Item
                name="splittingStrategy"
                label={t("rag.ragSettings.splittingStrategy.label")}
                rules={[
                  {
                    required: true,
                    message: t("rag.ragSettings.model.required")
                  }
                ]}>
                <Select
                  size="large"
                  showSearch
                  style={{ width: "100%" }}
                  className="mt-4"
                  options={[
                    "RecursiveCharacterTextSplitter",
                    "CharacterTextSplitter"
                  ].map((e) => ({
                    label: e,
                    value: e
                  }))}
                />
              </Form.Item>

              {splittingStrategy !== "RecursiveCharacterTextSplitter" && (
                <Form.Item
                  name="splittingSeparator"
                  label={t("rag.ragSettings.splittingSeparator.label")}
                  rules={[
                    {
                      required: true,
                      message: t("rag.ragSettings.splittingSeparator.required")
                    }
                  ]}>
                  <Input
                    size="large"
                    style={{ width: "100%" }}
                    placeholder={t(
                      "rag.ragSettings.splittingSeparator.placeholder"
                    )}
                  />
                </Form.Item>
              )}

              <Form.Item
                name="chunkSize"
                label={t("rag.ragSettings.chunkSize.label")}
                help={t(
                  "rag.ragSettings.chunkSize.help",
                  `Number of characters per text chunk (${VALIDATION_RANGES.chunkSize.min}-${VALIDATION_RANGES.chunkSize.max})`
                )}
                rules={[
                  {
                    required: true,
                    message: t("rag.ragSettings.chunkSize.required")
                  },
                  {
                    type: "number",
                    min: VALIDATION_RANGES.chunkSize.min,
                    max: VALIDATION_RANGES.chunkSize.max,
                    message: t(
                      "rag.ragSettings.chunkSize.range",
                      `Must be between ${VALIDATION_RANGES.chunkSize.min} and ${VALIDATION_RANGES.chunkSize.max}`
                    )
                  }
                ]}>
                <InputNumber
                  style={{ width: "100%" }}
                  min={VALIDATION_RANGES.chunkSize.min}
                  max={VALIDATION_RANGES.chunkSize.max}
                  placeholder={t("rag.ragSettings.chunkSize.placeholder")}
                />
              </Form.Item>
              <Form.Item
                name="chunkOverlap"
                label={t("rag.ragSettings.chunkOverlap.label")}
                help={t(
                  "rag.ragSettings.chunkOverlap.help",
                  `Overlap between chunks to maintain context (${VALIDATION_RANGES.chunkOverlap.min}-${VALIDATION_RANGES.chunkOverlap.max})`
                )}
                rules={[
                  {
                    required: true,
                    message: t("rag.ragSettings.chunkOverlap.required")
                  },
                  {
                    type: "number",
                    min: VALIDATION_RANGES.chunkOverlap.min,
                    max: VALIDATION_RANGES.chunkOverlap.max,
                    message: t(
                      "rag.ragSettings.chunkOverlap.range",
                      `Must be between ${VALIDATION_RANGES.chunkOverlap.min} and ${VALIDATION_RANGES.chunkOverlap.max}`
                    )
                  }
                ]}>
                <InputNumber
                  style={{ width: "100%" }}
                  min={VALIDATION_RANGES.chunkOverlap.min}
                  max={VALIDATION_RANGES.chunkOverlap.max}
                  placeholder={t("rag.ragSettings.chunkOverlap.placeholder")}
                />
              </Form.Item>

              <Form.Item
                name="noOfRetrievedDocs"
                label={t("rag.ragSettings.noOfRetrievedDocs.label")}
                help={t(
                  "rag.ragSettings.noOfRetrievedDocs.help",
                  `Number of documents to retrieve per query (${VALIDATION_RANGES.noOfRetrievedDocs.min}-${VALIDATION_RANGES.noOfRetrievedDocs.max})`
                )}
                rules={[
                  {
                    required: true,
                    message: t("rag.ragSettings.noOfRetrievedDocs.required")
                  },
                  {
                    type: "number",
                    min: VALIDATION_RANGES.noOfRetrievedDocs.min,
                    max: VALIDATION_RANGES.noOfRetrievedDocs.max,
                    message: t(
                      "rag.ragSettings.noOfRetrievedDocs.range",
                      `Must be between ${VALIDATION_RANGES.noOfRetrievedDocs.min} and ${VALIDATION_RANGES.noOfRetrievedDocs.max}`
                    )
                  }
                ]}>
                <InputNumber
                  style={{ width: "100%" }}
                  min={VALIDATION_RANGES.noOfRetrievedDocs.min}
                  max={VALIDATION_RANGES.noOfRetrievedDocs.max}
                  placeholder={t(
                    "rag.ragSettings.noOfRetrievedDocs.placeholder"
                  )}
                />
              </Form.Item>

              <Form.Item
                name="totalFilePerKB"
                label={t("rag.ragSettings.totalFilePerKB.label")}
                rules={[
                  {
                    required: true,
                    message: t("rag.ragSettings.totalFilePerKB.required")
                  },
                  {
                    type: "number",
                    min: VALIDATION_RANGES.totalFilePerKB.min,
                    message: t(
                      "rag.ragSettings.totalFilePerKB.range",
                      `Must be at least ${VALIDATION_RANGES.totalFilePerKB.min}`
                    )
                  }
                ]}>
                <InputNumber
                  style={{ width: "100%" }}
                  min={VALIDATION_RANGES.totalFilePerKB.min}
                  placeholder={t("rag.ragSettings.totalFilePerKB.placeholder")}
                />
              </Form.Item>

              <div className="flex justify-end">
                <SaveButton
                  loading={isSaveRAGPending}
                  btnType="submit"
                  disabled={!isFormValid}
                />
              </div>
            </Form>
          </div>

          <SidepanelRag />

          <div>
            <div>
              <h2 className="text-base font-semibold leading-7 text-text">
                {t("rag.prompt.label")}
              </h2>
              <div className="border-b border-border mt-3 mb-6"></div>
            </div>
            <SettingPrompt />
          </div>
        </div>
      )}
    </div>
  )
}

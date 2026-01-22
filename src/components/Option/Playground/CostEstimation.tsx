import React from "react"
import { Tooltip, Popover } from "antd"
import { useTranslation } from "react-i18next"
import { DollarSign, Info, TrendingUp, Coins } from "lucide-react"
import {
  getModelPricing,
  estimateCost,
  formatCost,
  getPriceTier,
  type ModelPricing
} from "@/utils/model-pricing"

type Props = {
  modelId: string | null
  provider?: string | null
  inputTokens: number
  outputTokens: number
  compact?: boolean
  className?: string
}

const TIER_COLORS: Record<string, string> = {
  free: "text-success",
  low: "text-success",
  medium: "text-warning",
  high: "text-orange-500",
  premium: "text-error"
}

const TIER_BG_COLORS: Record<string, string> = {
  free: "bg-success/10",
  low: "bg-success/10",
  medium: "bg-warning/10",
  high: "bg-orange-500/10",
  premium: "bg-error/10"
}

export const CostEstimation: React.FC<Props> = ({
  modelId,
  provider,
  inputTokens,
  outputTokens,
  compact = false,
  className
}) => {
  const { t } = useTranslation(["playground", "common"])

  const pricing = React.useMemo(() => {
    if (!modelId) return null
    return getModelPricing(modelId, provider)
  }, [modelId, provider])

  const { cost, tier } = React.useMemo(() => {
    if (!pricing) {
      return { cost: null, tier: null }
    }
    const calculatedCost = estimateCost(inputTokens, outputTokens, pricing)
    const priceTier = getPriceTier(pricing)
    return { cost: calculatedCost, tier: priceTier }
  }, [pricing, inputTokens, outputTokens])

  if (!modelId) {
    return null
  }

  const renderCostBreakdown = () => {
    if (!pricing) {
      return (
        <div className="text-xs text-text-muted">
          {t(
            "playground:cost.noPricing",
            "Pricing data not available for this model"
          )}
        </div>
      )
    }

    const inputCost = (inputTokens / 1000) * pricing.inputPer1K
    const outputCost = (outputTokens / 1000) * pricing.outputPer1K

    return (
      <div className="space-y-2 text-xs">
        <div className="font-medium">
          {t("playground:cost.breakdown", "Cost Breakdown")}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-text-muted">
              {t("playground:cost.inputTokens", "Input tokens")}
            </span>
            <span>
              {inputTokens.toLocaleString()} × ${pricing.inputPer1K}/1K
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">
              {t("playground:cost.outputTokens", "Output tokens")}
            </span>
            <span>
              {outputTokens.toLocaleString()} × ${pricing.outputPer1K}/1K
            </span>
          </div>
          <div className="border-t border-border pt-1">
            <div className="flex justify-between">
              <span className="text-text-muted">
                {t("playground:cost.inputCost", "Input cost")}
              </span>
              <span>{formatCost(inputCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">
                {t("playground:cost.outputCost", "Output cost")}
              </span>
              <span>{formatCost(outputCost)}</span>
            </div>
          </div>
          <div className="border-t border-border pt-1">
            <div className="flex justify-between font-medium">
              <span>{t("playground:cost.total", "Total")}</span>
              <span className={tier ? TIER_COLORS[tier] : ""}>
                {formatCost(inputCost + outputCost)}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-text-subtle">
          {t(
            "playground:cost.disclaimer",
            "Estimates are approximate and may vary based on actual API usage."
          )}
        </div>
      </div>
    )
  }

  if (compact) {
    if (!pricing || cost === null) {
      return null
    }

    return (
      <Tooltip title={renderCostBreakdown()} placement="top">
        <div
          className={`flex items-center gap-1 text-xs ${
            tier ? TIER_COLORS[tier] : "text-text-muted"
          } ${className || ""}`}>
          <Coins className="h-3 w-3" />
          <span>{formatCost(cost)}</span>
        </div>
      </Tooltip>
    )
  }

  return (
    <Popover
      content={renderCostBreakdown()}
      title={
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-text-muted" />
          {t("playground:cost.title", "Cost Estimation")}
        </div>
      }
      trigger="click"
      placement="bottomRight">
      <button
        type="button"
        className={`flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover ${className || ""}`}>
        {pricing ? (
          <>
            <span
              className={`flex items-center gap-1 ${
                tier ? TIER_COLORS[tier] : ""
              }`}>
              <Coins className="h-3.5 w-3.5" />
              {cost !== null && formatCost(cost)}
            </span>
            {tier && tier !== "free" && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  TIER_BG_COLORS[tier]
                } ${TIER_COLORS[tier]}`}>
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </span>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1 text-text-muted">
            <Info className="h-3.5 w-3.5" />
            {t("playground:cost.unknown", "Cost N/A")}
          </span>
        )}
      </button>
    </Popover>
  )
}

type SessionCostProps = {
  modelId: string | null
  provider?: string | null
  messages: Array<{
    generationInfo?: {
      prompt_eval_count?: number
      eval_count?: number
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
      }
    }
  }>
  className?: string
}

export const SessionCostEstimation: React.FC<SessionCostProps> = ({
  modelId,
  provider,
  messages,
  className
}) => {
  const { t } = useTranslation(["playground", "common"])

  const { totalInput, totalOutput, totalCost, pricing } = React.useMemo(() => {
    let inputSum = 0
    let outputSum = 0

    for (const msg of messages) {
      const info = msg.generationInfo
      if (info) {
        inputSum += info.prompt_eval_count ?? info.usage?.prompt_tokens ?? 0
        outputSum += info.eval_count ?? info.usage?.completion_tokens ?? 0
      }
    }

    const modelPricing = modelId ? getModelPricing(modelId, provider) : null
    const cost = modelPricing
      ? estimateCost(inputSum, outputSum, modelPricing)
      : null

    return {
      totalInput: inputSum,
      totalOutput: outputSum,
      totalCost: cost,
      pricing: modelPricing
    }
  }, [modelId, provider, messages])

  if (!modelId || totalInput === 0) {
    return null
  }

  const tier = pricing ? getPriceTier(pricing) : null

  return (
    <Tooltip
      title={
        <div className="space-y-1 text-xs">
          <div>{t("playground:cost.sessionStats", "Session Statistics")}</div>
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">Input:</span>
            <span>{totalInput.toLocaleString()} tokens</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">Output:</span>
            <span>{totalOutput.toLocaleString()} tokens</span>
          </div>
          {totalCost !== null && (
            <div className="flex justify-between gap-4 border-t border-border pt-1">
              <span className="text-text-muted">Cost:</span>
              <span className={tier ? TIER_COLORS[tier] : ""}>
                {formatCost(totalCost)}
              </span>
            </div>
          )}
        </div>
      }
      placement="top">
      <div
        className={`flex items-center gap-1.5 text-xs text-text-muted ${className || ""}`}>
        <TrendingUp className="h-3 w-3" />
        <span>
          {(totalInput + totalOutput).toLocaleString()}{" "}
          {t("playground:cost.tokens", "tokens")}
        </span>
        {totalCost !== null && (
          <span className={tier ? TIER_COLORS[tier] : ""}>
            ({formatCost(totalCost)})
          </span>
        )}
      </div>
    </Tooltip>
  )
}

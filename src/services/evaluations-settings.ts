import { defineSetting, getSetting, setSetting } from "@/services/settings/registry"

export type EvaluationDefaults = {
  defaultEvalType?: string
  defaultTargetModel?: string
  defaultSpecByType?: Record<string, string>
  defaultRunConfig?: string
  defaultDatasetId?: string | null
}

const STORAGE_KEY = "evaluationsDefaults"

const DEFAULTS: Required<EvaluationDefaults> = {
  defaultEvalType: "response_quality",
  defaultTargetModel: "gpt-3.5-turbo",
  defaultSpecByType: {},
  defaultRunConfig: JSON.stringify({ batch_size: 10 }, null, 2),
  defaultDatasetId: null
}

const EVALUATIONS_DEFAULTS_SETTING = defineSetting(
  STORAGE_KEY,
  DEFAULTS,
  (value) => ({
    ...DEFAULTS,
    ...(value && typeof value === "object" ? value : {})
  })
)

export async function getEvaluationDefaults(): Promise<EvaluationDefaults> {
  return await getSetting(EVALUATIONS_DEFAULTS_SETTING)
}

export async function setEvaluationDefaults(
  updates: Partial<EvaluationDefaults>
): Promise<EvaluationDefaults> {
  const current = await getEvaluationDefaults()
  const next = { ...current, ...updates }
  await setSetting(EVALUATIONS_DEFAULTS_SETTING, next)
  return next
}

export async function setDefaultSpecForType(
  evalType: string,
  specJson: string
): Promise<EvaluationDefaults> {
  const current = await getEvaluationDefaults()
  const byType = { ...(current.defaultSpecByType || {}) }
  byType[evalType] = specJson
  return await setEvaluationDefaults({ defaultSpecByType: byType })
}

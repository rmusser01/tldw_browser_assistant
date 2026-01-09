import { PROVIDER_REGISTRY } from "@/utils/provider-registry"

export const OAI_API_PROVIDERS = Object.entries(PROVIDER_REGISTRY)
  .filter(([, meta]) => typeof meta.baseUrl === "string")
  .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
  .map(([value, meta]) => ({
    label: meta.label,
    value,
    baseUrl: meta.baseUrl ?? ""
  }))

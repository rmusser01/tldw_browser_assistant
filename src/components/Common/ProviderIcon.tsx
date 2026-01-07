import { getProviderIconComponent } from "@/utils/provider-registry"

export const ProviderIcons = ({
  provider,
  className
}: {
  provider: string
  className?: string
}) => {
  const Icon = getProviderIconComponent(provider)
  return <Icon className={className} />
}

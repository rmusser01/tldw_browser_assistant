import React from "react"
import { Collapse, Typography } from "antd"
import { ChevronRight } from "lucide-react"

const { Text } = Typography

interface CollapsibleSectionProps {
  title: string
  description?: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Reusable collapsible section with consistent styling for admin pages.
 * Uses Ant Design Collapse with custom expand icon animation.
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  description,
  defaultOpen = false,
  children,
  className
}) => {
  return (
    <Collapse
      defaultActiveKey={defaultOpen ? ["1"] : []}
      ghost
      className={className}
      expandIcon={({ isActive }) => (
        <ChevronRight
          size={16}
          className={`transition-transform duration-200 ${isActive ? "rotate-90" : ""}`}
        />
      )}
      items={[
        {
          key: "1",
          label: (
            <div className="flex flex-col">
              <Text strong>{title}</Text>
              {description && (
                <Text type="secondary" className="text-xs font-normal">
                  {description}
                </Text>
              )}
            </div>
          ),
          children: <div className="pt-2">{children}</div>
        }
      ]}
    />
  )
}

export default CollapsibleSection

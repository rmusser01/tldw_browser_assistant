import React from "react"
import { Loader2 } from "lucide-react"

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "text"
type ButtonSize = "sm" | "md" | "lg"

type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  loading?: boolean
  className?: string
  type?: "button" | "submit" | "reset"
  ariaLabel?: string
  title?: string
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primaryStrong active:bg-primaryStrong",
  secondary:
    "bg-surface2 text-text hover:bg-surface active:bg-surface",
  danger:
    "bg-danger text-white hover:bg-danger active:bg-danger",
  ghost:
    "bg-transparent text-text-muted hover:bg-surface2 hover:text-text active:bg-surface2",
  text: "bg-transparent text-primary hover:text-primaryStrong hover:underline"
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs min-h-[28px]",
  md: "px-3.5 py-1.5 text-sm min-h-[36px]",
  lg: "px-5 py-2 text-base min-h-[44px]"
}

const baseStyles =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed"

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      children,
      onClick,
      disabled,
      loading,
      className,
      type = "button",
      ariaLabel,
      title
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        className={[
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={isDisabled}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-busy={loading}
        title={title}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)

Button.displayName = "Button"

export default Button

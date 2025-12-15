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
    "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600 dark:active:bg-blue-700",
  secondary:
    "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-500 dark:hover:bg-red-600 dark:active:bg-red-700",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700",
  text: "bg-transparent text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs min-h-[28px]",
  md: "px-3.5 py-1.5 text-sm min-h-[36px]",
  lg: "px-5 py-2 text-base min-h-[44px]"
}

const baseStyles =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"

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

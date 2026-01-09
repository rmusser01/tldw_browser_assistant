import React from "react"
import { NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"

type Props = {
  showBack: boolean
  isRTL: boolean
}

export const PrimaryToolbar: React.FC<React.PropsWithChildren<Props>> = ({
  showBack,
  isRTL,
  children
}) => {
  const { t } = useTranslation(["option", "common"])

  return (
    <div className="flex flex-1 items-center gap-2 min-w-0">
      {showBack && (
        <NavLink
          to="/"
          aria-label={t("option:header.backToHome", "Back to home")}
          className="rounded-md p-1 text-text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus">
          <span
            className={`text-sm font-medium ${isRTL ? "text-right" : ""}`}>
            {t("option:header.backToHome", "Back to home")}
          </span>
        </NavLink>
      )}
      {children}
    </div>
  )
}

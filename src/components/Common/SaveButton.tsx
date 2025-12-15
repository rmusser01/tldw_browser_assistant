import { useState } from "react"
import { CheckIcon, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
type Props = {
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
  text?: string
  textOnSave?: string
  btnType?: "button" | "submit" | "reset"
}

export const SaveButton = ({
  onClick,
  disabled,
  loading,
  className,
  text = "save",
  textOnSave = "saved",
  btnType = "button"
}: Props) => {
  const [clickedSave, setClickedSave] = useState(false)
  const { t } = useTranslation("common")

  const showSaved = clickedSave && !loading

  return (
    <button
      type={btnType}
      onClick={() => {
        if (loading) return
        setClickedSave(true)
        if (onClick) {
          onClick()
        }
        setTimeout(() => {
          setClickedSave(false)
        }, 1000)
      }}
      disabled={disabled || loading}
      className={`inline-flex mt-4 items-center rounded-md border border-transparent bg-primary px-3 py-2 min-h-[40px] text-sm font-medium leading-4 text-surface shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] disabled:opacity-50 ${className}`}>
      {loading ? (
        <Loader2 className="icon mr-2 animate-spin" />
      ) : showSaved ? (
        <CheckIcon className="icon mr-2" />
      ) : null}
      {loading ? t("saving", "Saving...") : showSaved ? t(textOnSave) : t(text)}
    </button>
  )
}

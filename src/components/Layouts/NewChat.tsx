import { SquarePen } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useMessageOption } from "@/hooks/useMessageOption"

type Props = {
  clearChat: () => void
}

export const NewChat: React.FC<Props> = ({ clearChat }) => {
  const { t } = useTranslation(["option", "common"])

  const { temporaryChat, setTemporaryChat, messages } = useMessageOption()

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={clearChat}
        className="inline-flex bg-surface items-center rounded-s-lg rounded-e-none border border-border px-3 py-2.5 pe-6 text-xs lg:text-sm font-medium leading-4 text-text disabled:opacity-50 ease-in-out transition-colors duration-200 hover:bg-surface2">
        <SquarePen className="size-4 sm:size-5" />
        <span className="truncate ms-3 hidden sm:inline">{t("newChat")}</span>
      </button>
      
      {/* </Dropdown> */}
    </div>
  )
}

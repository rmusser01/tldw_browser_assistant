import { PencilIcon } from "lucide-react"
import { useMessage } from "../../../hooks/useMessage"
import { useTranslation } from 'react-i18next';

export const PlaygroundNewChat = () => {
  const { setHistory, setMessages, setHistoryId } = useMessage()
  const { t } = useTranslation('optionChat')

  const handleClick = () => {
    setHistoryId(null)
    setMessages([])
    setHistory([])
  }

  return (
    <button
      onClick={handleClick}
      className="flex w-full rounded-md border border-border bg-transparent p-2 text-text-muted transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <PencilIcon className="mx-3 h-5 w-5" aria-hidden="true" />
      <span className="inline-flex text-sm font-semibold">
        {t('newChat')}
      </span>
    </button>
  )
}

import { SquarePen } from "lucide-react"
import { useTranslation } from "react-i18next"
import { notification, Tooltip } from "antd"
import { useMessageOption } from "@/hooks/useMessageOption"
import { BsIncognito } from "react-icons/bs"
import { isFireFoxPrivateMode } from "@/utils/is-private-mode"

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
        className="inline-flex dark:bg-transparent bg-white items-center rounded-s-lg rounded-e-none border dark:border-gray-700 bg-transparent px-3 py-2.5 pe-6 text-xs lg:text-sm font-medium leading-4 text-gray-800 dark:text-white disabled:opacity-50 ease-in-out transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white">
        <SquarePen className="size-4 sm:size-5" />
        <span className="truncate ms-3 hidden sm:inline">{t("newChat")}</span>
      </button>
      <Tooltip title={t("temporaryChat")}>
        <button
          data-istemporary-chat={temporaryChat}
          onClick={() => {
            if (isFireFoxPrivateMode) {
              notification.error({
                message: "Error",
                description:
                  "Page Assist can't save chat in Firefox Private Mode. Temporary chat is enabled by default. More fixes coming soon."
              })
              return
            }

            setTemporaryChat(!temporaryChat)
            if (messages.length > 0) {
              clearChat()
            }
          }}
          className="inline-flex dark:bg-transparent bg-white items-center rounded-lg border-s-0 rounded-s-none border dark:border-gray-700 bg-transparent px-3 py-2.5 text-xs lg:text-sm font-medium leading-4 text-gray-800 dark:text-white disabled:opacity-50 ease-in-out transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white data-[istemporary-chat='true']:bg-purple-900 data-[istemporary-chat='true']:dark:bg-purple-900 data-[istemporary-chat='true']:text-white data-[istemporary-chat='true']:dark:text-white data-[istemporary-chat='true']:ring-2 data-[istemporary-chat='true']:ring-purple-300 data-[istemporary-chat='true']:shadow data-[istemporary-chat='true']:shadow-purple-500/30">
          <BsIncognito className="size-4 sm:size-5 text-gray-500 dark:text-gray-400 data-[istemporary-chat='true']:text-white data-[istemporary-chat='true']:dark:text-white" />
        </button>
      </Tooltip>
      {/* </Dropdown> */}
    </div>
  )
}

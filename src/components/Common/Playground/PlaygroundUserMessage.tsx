import { useTTS } from "@/hooks/useTTS"
import { useStorage } from "@plasmohq/storage/hook"
import React from "react"
import { useTranslation } from "react-i18next"
import { EditMessageForm } from "./EditMessageForm"
import { Image, Tag, Tooltip } from "antd"
import {
  CheckIcon,
  CopyIcon,
  Pen,
  PlayIcon,
  Square,
  CornerUpLeft
} from "lucide-react"
import { HumanMessage } from "./HumanMessge"
import { ChatDocuments } from "@/models/ChatTypes"
import { DocumentChip } from "./DocumentChip"
import { DocumentFile } from "./DocumentFile"
import { buildChatTextClass } from "@/utils/chat-style"
import { IconButton } from "../IconButton"
import { tagColors } from "@/utils/color"
import { useUiModeStore } from "@/store/ui-mode"
import { useStoreMessageOption } from "@/store/option"

const ACTION_BUTTON_CLASS =
  "flex items-center justify-center w-10 h-10 sm:w-6 sm:h-6 rounded-full border border-border bg-surface2 text-text-muted hover:bg-surface hover:text-text transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-focus"

type Props = {
  message: string
  message_type?: string
  hideCopy?: boolean
  botAvatar?: JSX.Element
  userAvatar?: JSX.Element
  isBot: boolean
  name: string
  images?: string[]
  currentMessageIndex: number
  totalMessages: number
  onRegenerate: () => void
  onEditFormSubmit: (value: string, isSend: boolean) => void
  isProcessing: boolean
  webSearch?: {}
  isSearchingInternet?: boolean
  sources?: any[]
  hideEditAndRegenerate?: boolean
  onSourceClick?: (source: any) => void
  isTTSEnabled?: boolean
  generationInfo?: any
  isStreaming: boolean
  reasoningTimeTaken?: number
  openReasoning?: boolean
  modelImage?: string
  modelName?: string
  documents?: ChatDocuments
  messageId?: string
  serverMessageId?: string | null
}

export const PlaygroundUserMessageBubble: React.FC<Props> = (props) => {
  const [checkWideMode] = useStorage("checkWideMode", false)
  const [userTextColor] = useStorage("chatUserTextColor", "default")
  const [userTextFont] = useStorage("chatUserTextFont", "default")
  const [userTextSize] = useStorage("chatUserTextSize", "md")
  const [isBtnPressed, setIsBtnPressed] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const { t } = useTranslation("common")
  const { cancel, isSpeaking, speak } = useTTS()
  const uiMode = useUiModeStore((state) => state.mode)
  const isProMode = uiMode === "pro"
  const setReplyTarget = useStoreMessageOption((state) => state.setReplyTarget)
  const actionBarVisibility = isProMode
    ? "opacity-100"
    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
  const replyId = props.messageId ?? props.serverMessageId ?? null
  const canReply =
    isProMode && Boolean(replyId) && !props.message_type?.startsWith("compare")
  const buildReplyPreview = React.useCallback(
    (value: string) => {
      const collapsed = value.replace(/\s+/g, " ").trim()
      if (!collapsed) {
        return t("replyTargetFallback", "Message")
      }
      if (collapsed.length > 140) {
        return `${collapsed.slice(0, 137)}...`
      }
      return collapsed
    },
    [t]
  )

  const userTextClass = React.useMemo(
    () => buildChatTextClass(userTextColor, userTextFont, userTextSize),
    [userTextColor, userTextFont, userTextSize]
  )

  return (
    <div
      data-testid="chat-message"
      data-role="user"
      data-index={props.currentMessageIndex}
      className={`group gap-2 relative flex w-full max-w-3xl flex-col items-end justify-center pb-2 md:px-4 text-text ${checkWideMode ? "max-w-none" : ""}`}>
      {!editMode && props?.message_type ? (
        <Tag color={tagColors[props?.message_type] || "default"}>
          {t(`copilot.${props?.message_type}`)}
        </Tag>
      ) : null}

      {props?.documents &&
        props?.documents.length > 0 &&
        props.documents.filter((d) => d.type === "file").length > 0 && (
          <div className="flex flex-wrap gap-2">
            {props.documents
              .filter((d) => d.type === "file")
              .map((doc, index) => (
                <DocumentFile
                  key={index}
                  document={{
                    filename: doc.filename!,
                    fileSize: doc.fileSize!
                  }}
                />
              ))}
          </div>
        )}

      {props?.documents &&
        props?.documents.length > 0 &&
        props.documents.filter((d) => d.type === "tab").length > 0 && (
          <div className="flex flex-wrap gap-2">
            {props.documents
              .filter((d) => d.type === "tab")
              .map((doc, index) => (
                <DocumentChip
                  key={index}
                  document={{
                    title: doc.title,
                    url: doc.url,
                    favIconUrl: doc.favIconUrl
                  }}
                />
              ))}
          </div>
        )}

      {!editMode && props?.message?.length > 0 && (
        <div
          dir="auto"
          data-is-not-editable={!editMode}
          className={`message-bubble bg-surface2/80 shadow-sm rounded-3xl prose dark:prose-invert break-words min-h-7 prose-p:opacity-95 prose-strong:opacity-100 border border-border max-w-[100%] sm:max-w-[90%] px-4 py-3 rounded-br-lg ${userTextClass} ${
            props.message_type && !editMode ? "italic" : ""
          }`}>
          <HumanMessage message={props.message} />
        </div>
      )}

      {editMode && (
        <div
          dir="auto"
          className={`message-bubble bg-surface2/80 shadow-sm rounded-3xl prose dark:prose-invert break-words min-h-7 prose-p:opacity-95 prose-strong:opacity-100 border border-border max-w-[100%] sm:max-w-[90%] px-4 py-3 rounded-br-lg ${userTextClass} ${
            props.message_type && !editMode ? "italic" : ""
          }`}>
          <div className="w-screen max-w-[100%]">
            <EditMessageForm
              value={props.message}
              onSumbit={props.onEditFormSubmit}
              onClose={() => setEditMode(false)}
              isBot={props.isBot}
            />
          </div>
        </div>
      )}

      {props.images &&
        props.images.filter((img) => img.length > 0).length > 0 && (
          <div>
            {props.images
              .filter((image) => image.length > 0)
              .map((image, index) => (
                <Image
                  key={index}
                  src={image}
                  alt="Uploaded Image"
                  width={180}
                  className="rounded-lg relative"
                />
              ))}
          </div>
        )}

      {!props.isProcessing && !editMode ? (
        <div className={`flex items-center gap-2 transition-opacity ${actionBarVisibility}`}>
          {props.isTTSEnabled && (
            <Tooltip title={t("tts")}>
              <IconButton
                ariaLabel={t("tts") as string}
                onClick={() => {
                  if (isSpeaking) {
                    cancel()
                  } else {
                    speak({
                      utterance: props.message
                    })
                  }
                }}
                className={ACTION_BUTTON_CLASS}>
                {!isSpeaking ? (
                  <PlayIcon className="w-3 h-3 text-text-subtle group-hover:text-text" />
                ) : (
                  <Square className="w-3 h-3 text-danger group-hover:text-danger" />
                )}
              </IconButton>
            </Tooltip>
          )}
          {!props.hideCopy && (
            <Tooltip title={t("copyToClipboard")}>
              <IconButton
                ariaLabel={t("copyToClipboard") as string}
                onClick={() => {
                  navigator.clipboard.writeText(props.message)
                  setIsBtnPressed(true)
                  setTimeout(() => {
                    setIsBtnPressed(false)
                  }, 2000)
                }}
                className={ACTION_BUTTON_CLASS}>
                {!isBtnPressed ? (
                  <CopyIcon className="w-3 h-3 text-text-subtle group-hover:text-text" />
                ) : (
                  <CheckIcon className="w-3 h-3 text-success group-hover:text-success" />
                )}
              </IconButton>
            </Tooltip>
          )}
          {canReply && (
            <Tooltip title={t("reply", "Reply")}>
              <IconButton
                ariaLabel={t("reply", "Reply") as string}
                onClick={() => {
                  if (!replyId) return
                  setReplyTarget({
                    id: replyId,
                    preview: buildReplyPreview(props.message),
                    name: props.name,
                    isBot: props.isBot
                  })
                }}
                className={ACTION_BUTTON_CLASS}>
                <CornerUpLeft className="w-3 h-3 text-text-subtle group-hover:text-text" />
              </IconButton>
            </Tooltip>
          )}

          {!props.hideEditAndRegenerate && (
            <Tooltip title={t("edit")}>
              <IconButton
                onClick={() => setEditMode(true)}
                ariaLabel={t("edit") as string}
                className={ACTION_BUTTON_CLASS}>
                <Pen className="w-3 h-3 text-text-subtle group-hover:text-text" />
              </IconButton>
            </Tooltip>
          )}
        </div>
      ) : (
        // add invisible div to prevent layout shift
        <div className="invisible">
          <div className={ACTION_BUTTON_CLASS}></div>
        </div>
      )}
    </div>
  )
}

import React from "react"
import { PlaygroundMessage } from "~/components/Common/Playground/Message"
import { useMessage } from "~/hooks/useMessage"
import { EmptySidePanel } from "../Chat/empty"
import { useWebUI } from "@/store/webui"
import { MessageSourcePopup } from "@/components/Common/Playground/MessageSourcePopup"
import { useVirtualizer } from "@tanstack/react-virtual"

type Props = {
  scrollParentRef?: React.RefObject<HTMLDivElement>
  searchQuery?: string
}

export const SidePanelBody = ({
  scrollParentRef,
  searchQuery,
  inputRef
}: Props & { inputRef?: React.RefObject<HTMLTextAreaElement> }) => {
  const {
    messages,
    streaming,
    isProcessing,
    regenerateLastMessage,
    editMessage,
    isSearchingInternet,
    createChatBranch,
    temporaryChat,
    stopStreamingRequest,
    serverChatId,
    isEmbedding
  } = useMessage()
  const [isSourceOpen, setIsSourceOpen] = React.useState(false)
  const [source, setSource] = React.useState<any>(null)
  const { ttsEnabled } = useWebUI()
  const scrollAnchorRef = React.useRef<number | null>(null)

  const parentEl = scrollParentRef?.current || null
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentEl,
    estimateSize: () => 120,
    // Reduced from 6 to 3 for better performance on large conversations
    overscan: 3,
    measureElement: (el) => el?.getBoundingClientRect().height || 120
  })

  // Lock scroll position during streaming to prevent virtualizer jumps
  React.useEffect(() => {
    if (!parentEl) return

    if (streaming) {
      // Save current scroll position when streaming starts
      scrollAnchorRef.current = parentEl.scrollTop
    } else {
      // Clear anchor when streaming ends
      scrollAnchorRef.current = null
    }
  }, [streaming, parentEl])

  // Prevent virtualizer scroll jumps during streaming
  React.useEffect(() => {
    if (!parentEl || !streaming || scrollAnchorRef.current === null) return

    const handleScroll = () => {
      // If user manually scrolls, update the anchor
      if (Math.abs(parentEl.scrollTop - scrollAnchorRef.current!) > 10) {
        scrollAnchorRef.current = parentEl.scrollTop
      }
    }

    parentEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => parentEl.removeEventListener('scroll', handleScroll)
  }, [streaming, parentEl])

  return (
    <>
      <div className="relative flex w-full flex-col items-center pt-16 pb-4">
        {messages.length === 0 && <EmptySidePanel inputRef={inputRef} />}
        <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vr) => {
            const index = vr.index
            const message = messages[index]
            return (
              <div key={vr.key} ref={rowVirtualizer.measureElement} data-index={index} style={{ position: 'absolute', top: 0, left: 0, transform: `translateY(${vr.start}px)`, width: '100%' }}>
                <PlaygroundMessage
                  isBot={message.isBot}
                  message={message.message}
                  name={message.name}
                  images={message.images || []}
                  currentMessageIndex={index}
                  totalMessages={messages.length}
                  onRegenerate={regenerateLastMessage}
                  message_type={message.messageType}
                  isProcessing={isProcessing}
                  isSearchingInternet={isSearchingInternet}
                  sources={message.sources}
                  onEditFormSubmit={(value) => { editMessage(index, value, !message.isBot) }}
                  onNewBranch={() => { createChatBranch(index) }}
                  onSourceClick={(data) => { setSource(data); setIsSourceOpen(true) }}
                  isTTSEnabled={ttsEnabled}
                  generationInfo={message?.generationInfo}
                  isStreaming={streaming}
                  reasoningTimeTaken={message?.reasoning_time_taken}
                  modelImage={message?.modelImage}
                  modelName={message?.modelName}
                  temporaryChat={temporaryChat}
                  onStopStreaming={stopStreamingRequest}
                  serverChatId={serverChatId}
                  serverMessageId={message.serverMessageId}
                  searchQuery={searchQuery}
                  isEmbedding={isEmbedding}
                />
              </div>
            )
          })}
        </div>
      </div>

      <MessageSourcePopup
        open={isSourceOpen}
        setOpen={setIsSourceOpen}
        source={source}
      />
    </>
  )
}

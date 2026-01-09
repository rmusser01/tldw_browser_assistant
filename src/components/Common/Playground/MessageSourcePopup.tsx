import { KnowledgeIcon } from "@/components/Option/Knowledge/KnowledgeIcon"
import { Modal } from "antd"

type Props = {
  source: any
  open: boolean
  setOpen: (open: boolean) => void
}

export const MessageSourcePopup: React.FC<Props> = ({
  source,
  open,
  setOpen
}) => {
  return (
    <Modal
      open={open}
      // mask={false}
      zIndex={10000}
      onCancel={() => setOpen(false)}
      footer={null}
      onOk={() => setOpen(false)}>
      <div className="flex flex-col gap-2 mt-6">
        <h4 className="inline-flex items-center gap-2 rounded-md border border-border bg-surface2 px-2 py-1 text-body font-semibold text-text">
          {source?.type && (
            <KnowledgeIcon type={source?.type} className="h-4 w-5" />
          )}
          {source?.name}
        </h4>
        {source?.type === "pdf" ? (
          <>
            <p className="text-body text-text-muted">{source?.pageContent}</p>

            <div className="flex flex-wrap gap-3">
              <span className="rounded-md border border-border bg-surface px-2 py-1 text-caption text-text-muted">
                {`Page ${source?.metadata?.page}`}
              </span>

              <span className="rounded-md border border-border bg-surface px-2 py-1 text-caption text-text-muted">
                {`Line ${source?.metadata?.loc?.lines?.from} - ${source?.metadata?.loc?.lines?.to}`}
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="text-body text-text-muted">{source?.pageContent}</p>
          </>
        )}
      </div>
    </Modal>
  )
}

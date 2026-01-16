import React from "react"
import { useAntdModal } from "@/hooks/useAntdModal"

type ModalInstance = ReturnType<ReturnType<typeof useAntdModal>["confirm"]>
type ConfirmOptions = Parameters<ReturnType<typeof useAntdModal>["confirm"]>[0]
type ConfirmRefs = {
  instance?: React.MutableRefObject<ModalInstance | null>
  resolver?: React.MutableRefObject<((confirmed: boolean) => void) | null>
}

export const useConfirmModal = () => {
  const modal = useAntdModal()

  return React.useCallback(
    (options: ConfirmOptions, refs?: ConfirmRefs) =>
      new Promise<boolean>((resolve) => {
        const resolverRef = refs?.resolver
        if (resolverRef?.current) {
          resolverRef.current(false)
        }
        let settled = false
        const finalize = (value: boolean) => {
          if (settled) return
          settled = true
          if (resolverRef?.current === resolve) {
            resolverRef.current = null
          }
          resolve(value)
        }
        const clearInstance = () => {
          if (refs?.instance) {
            refs.instance.current = null
          }
        }
        if (resolverRef) {
          resolverRef.current = resolve
        }

        const instance = modal.confirm({
          ...options,
          onOk: async () => {
            const result = await options.onOk?.()
            finalize(true)
            clearInstance()
            return result
          },
          onCancel: () => {
            options.onCancel?.()
            finalize(false)
            clearInstance()
          },
          afterClose: () => {
            options.afterClose?.()
            finalize(false)
            clearInstance()
          }
        })

        if (refs?.instance) {
          refs.instance.current = instance
        }
      }),
    [modal]
  )
}

export const cleanupAntOverlays = () => {
  if (typeof document === "undefined") return
  const hasModal = document.querySelector(".ant-modal")
  const hasDrawer = document.querySelector(".ant-drawer")
  if (hasModal || hasDrawer) return

  const staleNodes = document.querySelectorAll(
    ".ant-modal-mask, .ant-modal-wrap, .ant-drawer-mask, .ant-drawer-wrap"
  )
  staleNodes.forEach((node) => {
    node.remove()
  })
}

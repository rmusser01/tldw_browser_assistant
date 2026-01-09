import type { StoreSlice } from "@/store/option/slices/types"

export const createReplySlice: StoreSlice<
  Pick<import("@/store/option/types").State, "replyTarget" | "setReplyTarget" | "clearReplyTarget">
> = (set) => ({
  replyTarget: null,
  setReplyTarget: (target) => set({ replyTarget: target }),
  clearReplyTarget: () => set({ replyTarget: null })
})

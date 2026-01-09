import type { StoreSlice } from "@/store/option/slices/types"

export const createServerChatSlice: StoreSlice<
  Pick<
    import("@/store/option/types").State,
    | "serverChatId"
    | "setServerChatId"
    | "serverChatTitle"
    | "setServerChatTitle"
    | "serverChatCharacterId"
    | "setServerChatCharacterId"
    | "serverChatMetaLoaded"
    | "setServerChatMetaLoaded"
    | "serverChatState"
    | "setServerChatState"
    | "serverChatVersion"
    | "setServerChatVersion"
    | "serverChatTopic"
    | "setServerChatTopic"
    | "serverChatClusterId"
    | "setServerChatClusterId"
    | "serverChatSource"
    | "setServerChatSource"
    | "serverChatExternalRef"
    | "setServerChatExternalRef"
  >
> = (set) => ({
  serverChatId: null,
  setServerChatId: (id) =>
    set(() => ({
      serverChatId: id,
      serverChatState: id ? "in-progress" : null,
      serverChatVersion: null,
      serverChatTitle: null,
      serverChatCharacterId: null,
      serverChatMetaLoaded: false,
      serverChatTopic: null,
      serverChatClusterId: null,
      serverChatSource: null,
      serverChatExternalRef: null
    })),
  serverChatTitle: null,
  setServerChatTitle: (serverChatTitle) =>
    set({ serverChatTitle: serverChatTitle != null ? serverChatTitle : null }),
  serverChatCharacterId: null,
  setServerChatCharacterId: (serverChatCharacterId) =>
    set({
      serverChatCharacterId:
        serverChatCharacterId != null ? serverChatCharacterId : null
    }),
  serverChatMetaLoaded: false,
  setServerChatMetaLoaded: (serverChatMetaLoaded) =>
    set({ serverChatMetaLoaded }),
  serverChatState: null,
  setServerChatState: (state) =>
    set({ serverChatState: state ?? null }),
  serverChatVersion: null,
  setServerChatVersion: (version) =>
    set({ serverChatVersion: version != null ? version : null }),
  serverChatTopic: null,
  setServerChatTopic: (topic) =>
    set({ serverChatTopic: topic != null ? topic : null }),
  serverChatClusterId: null,
  setServerChatClusterId: (clusterId) =>
    set({ serverChatClusterId: clusterId != null ? clusterId : null }),
  serverChatSource: null,
  setServerChatSource: (source) =>
    set({ serverChatSource: source != null ? source : null }),
  serverChatExternalRef: null,
  setServerChatExternalRef: (ref) =>
    set({ serverChatExternalRef: ref != null ? ref : null })
})

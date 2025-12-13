/**
 * Folder System Zustand Store
 *
 * Manages folder and keyword state, syncing with tldw_server.
 * UI preferences (expand state, colors) are persisted locally.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useShallow } from "zustand/react/shallow"
import type { Folder, Keyword, FolderKeywordLink, ConversationKeywordLink } from "@/db/dexie/types"
import { db } from "@/db/dexie/schema"
import {
  fetchFolders,
  fetchKeywords,
  fetchFolderKeywordLinks,
  fetchConversationKeywordLinks,
  createFolder as apiCreateFolder,
  updateFolder as apiUpdateFolder,
  deleteFolder as apiDeleteFolder,
  createKeyword as apiCreateKeyword,
  deleteKeyword as apiDeleteKeyword,
  linkKeywordToFolder as apiLinkKeywordToFolder,
  linkKeywordToConversation as apiLinkKeywordToConversation,
  unlinkKeywordFromConversation as apiUnlinkKeywordFromConversation
} from "@/services/folder-api"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FolderUIPrefs {
  isOpen: boolean
  color?: string
}

export interface FolderTreeNode {
  key: number
  title: string
  folder: Folder
  children: FolderTreeNode[]
  keywords: Keyword[]
  itemCount: number
}

interface FolderState {
  // Server data (cached)
  folders: Folder[]
  keywords: Keyword[]
  folderKeywordLinks: FolderKeywordLink[]
  conversationKeywordLinks: ConversationKeywordLink[]

  // Loading state
  isLoading: boolean
  lastSynced: number | null
  error: string | null

  // View state
  viewMode: 'folders' | 'date'

  // Local UI preferences (persisted)
  uiPrefs: Record<number, FolderUIPrefs>

  // Actions - Data
  setFolders: (folders: Folder[]) => void
  setKeywords: (keywords: Keyword[]) => void
  setFolderKeywordLinks: (links: FolderKeywordLink[]) => void
  setConversationKeywordLinks: (links: ConversationKeywordLink[]) => void

  // Actions - UI
  setViewMode: (mode: 'folders' | 'date') => void
  toggleFolderOpen: (folderId: number) => void
  setFolderColor: (folderId: number, color: string | undefined) => void
  expandAllFolders: () => void
  collapseAllFolders: () => void

  // Actions - Server operations
  refreshFromServer: () => Promise<void>
  createFolder: (name: string, parentId?: number | null) => Promise<Folder | null>
  updateFolder: (id: number, data: { name?: string; parent_id?: number | null }) => Promise<boolean>
  deleteFolder: (id: number) => Promise<boolean>
  createKeyword: (keyword: string) => Promise<Keyword | null>
  addKeywordToFolder: (folderId: number, keywordId: number) => Promise<boolean>
  addConversationToFolder: (conversationId: string, folderId: number) => Promise<boolean>
  removeConversationFromFolder: (conversationId: string, folderId: number) => Promise<boolean>

  // Computed helpers
  getFolderTree: () => FolderTreeNode[]
  getKeywordsForFolder: (folderId: number) => Keyword[]
  getFoldersForConversation: (conversationId: string) => Folder[]
  getConversationsForFolder: (folderId: number) => string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Build folder tree from flat list
// ─────────────────────────────────────────────────────────────────────────────

export const buildFolderTree = (
  folders: Folder[],
  keywords: Keyword[],
  folderKeywordLinks: FolderKeywordLink[],
  conversationKeywordLinks: ConversationKeywordLink[]
): FolderTreeNode[] => {
  const activeFolders = folders.filter(f => !f.deleted)
  const activeKeywords = keywords.filter(k => !k.deleted)
  const keywordById = new Map<number, Keyword>()
  activeKeywords.forEach(k => keywordById.set(k.id, k))

  // Build keyword lookup by folder
  const keywordsByFolder = new Map<number, Keyword[]>()
  const keywordIdsByFolder = new Map<number, Set<number>>()
  folderKeywordLinks.forEach(link => {
    const kw = keywordById.get(link.keyword_id)
    if (!kw) return

    let seen = keywordIdsByFolder.get(link.folder_id)
    if (!seen) {
      seen = new Set<number>()
      keywordIdsByFolder.set(link.folder_id, seen)
    }

    if (seen.has(kw.id)) return
    seen.add(kw.id)

    let existing = keywordsByFolder.get(link.folder_id)
    if (!existing) {
      existing = []
      keywordsByFolder.set(link.folder_id, existing)
    }
    existing.push(kw)
  })

  // Count conversations per folder (via keywords)
  const conversationsByKeyword = new Map<number, Set<string>>()
  conversationKeywordLinks.forEach(link => {
    const existing = conversationsByKeyword.get(link.keyword_id) || new Set()
    existing.add(link.conversation_id)
    conversationsByKeyword.set(link.keyword_id, existing)
  })

  // Create nodes
  const nodeMap = new Map<number, FolderTreeNode>()
  activeFolders.forEach(folder => {
    const folderKeywords = keywordsByFolder.get(folder.id) || []
    const conversationIds = new Set<string>()
    folderKeywords.forEach(kw => {
      const convs = conversationsByKeyword.get(kw.id)
      if (convs) convs.forEach(c => conversationIds.add(c))
    })

    nodeMap.set(folder.id, {
      key: folder.id,
      title: folder.name,
      folder,
      children: [],
      keywords: folderKeywords,
      itemCount: conversationIds.size
    })
  })

  // Build hierarchy
  const roots: FolderTreeNode[] = []
  activeFolders.forEach(folder => {
    const node = nodeMap.get(folder.id)!
    if (folder.parent_id && nodeMap.has(folder.parent_id)) {
      nodeMap.get(folder.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Sort children by name
  const sortChildren = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title))
    nodes.forEach(n => sortChildren(n.children))
  }
  sortChildren(roots)

  return roots
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useFolderStore = create<FolderState>()(
  persist(
    (set, get) => ({
      // Initial state
      folders: [],
      keywords: [],
      folderKeywordLinks: [],
      conversationKeywordLinks: [],
      isLoading: false,
      lastSynced: null,
      error: null,
      viewMode: 'date',
      uiPrefs: {},

      // Setters
      setFolders: (folders) => set({ folders }),
      setKeywords: (keywords) => set({ keywords }),
      setFolderKeywordLinks: (links) => set({ folderKeywordLinks: links }),
      setConversationKeywordLinks: (links) => set({ conversationKeywordLinks: links }),

      // UI actions
      setViewMode: (mode) => set({ viewMode: mode }),

      toggleFolderOpen: (folderId) => set((state) => ({
        uiPrefs: {
          ...state.uiPrefs,
          [folderId]: {
            ...state.uiPrefs[folderId],
            isOpen: !(state.uiPrefs[folderId]?.isOpen ?? true)
          }
        }
      })),

      setFolderColor: (folderId, color) =>
        set((state) => {
          const prev = state.uiPrefs[folderId]
          return {
            uiPrefs: {
              ...state.uiPrefs,
              [folderId]: {
                ...prev,
                isOpen: prev?.isOpen ?? true,
                color
              }
            }
          }
        }),

      expandAllFolders: () => set((state) => {
        const newPrefs = { ...state.uiPrefs }
        state.folders.forEach(f => {
          newPrefs[f.id] = { ...newPrefs[f.id], isOpen: true }
        })
        return { uiPrefs: newPrefs }
      }),

      collapseAllFolders: () => set((state) => {
        const newPrefs = { ...state.uiPrefs }
        state.folders.forEach(f => {
          newPrefs[f.id] = { ...newPrefs[f.id], isOpen: false }
        })
        return { uiPrefs: newPrefs }
      }),

      // Server sync
      refreshFromServer: async () => {
        set({ isLoading: true, error: null })
        try {
          const [folders, keywords, folderKeywordLinks, conversationKeywordLinks] = await Promise.all([
            fetchFolders(),
            fetchKeywords(),
            fetchFolderKeywordLinks(),
            fetchConversationKeywordLinks()
          ])

          const hadData =
            get().folders.length > 0 ||
            get().keywords.length > 0 ||
            get().folderKeywordLinks.length > 0 ||
            get().conversationKeywordLinks.length > 0

          const looksLikeFailure =
            hadData &&
            folders.length === 0 &&
            keywords.length === 0 &&
            folderKeywordLinks.length === 0 &&
            conversationKeywordLinks.length === 0

          if (looksLikeFailure) {
            throw new Error('Folder sync returned empty payload; keeping cached data')
          }

          // Cache to Dexie (atomic)
          await db.transaction(
            "rw",
            db.folders,
            db.keywords,
            db.folderKeywordLinks,
            db.conversationKeywordLinks,
            async () => {
              await Promise.all([
                db.folders.clear(),
                db.keywords.clear(),
                db.folderKeywordLinks.clear(),
                db.conversationKeywordLinks.clear()
              ])

              await Promise.all([
                db.folders.bulkPut(folders),
                db.keywords.bulkPut(keywords),
                db.folderKeywordLinks.bulkPut(folderKeywordLinks),
                db.conversationKeywordLinks.bulkPut(conversationKeywordLinks)
              ])
            }
          )

          set({
            folders,
            keywords,
            folderKeywordLinks,
            conversationKeywordLinks,
            lastSynced: Date.now(),
            isLoading: false
          })
        } catch (error) {
          console.error('Failed to refresh folders from server:', error)
          set({
            error: error instanceof Error ? error.message : 'Failed to sync',
            isLoading: false
          })

          // Fall back to cached data
          try {
            const [folders, keywords, folderKeywordLinks, conversationKeywordLinks] = await Promise.all([
              db.folders.toArray(),
              db.keywords.toArray(),
              db.folderKeywordLinks.toArray(),
              db.conversationKeywordLinks.toArray()
            ])
            set({ folders, keywords, folderKeywordLinks, conversationKeywordLinks })
          } catch {
            // Ignore cache read errors
          }
        }
      },

      // CRUD operations
      createFolder: async (name, parentId) => {
        const folder = await apiCreateFolder(name, parentId)
        if (folder) {
          set((state) => ({
            folders: [...state.folders, folder],
            uiPrefs: {
              ...state.uiPrefs,
              [folder.id]: { isOpen: true }
            }
          }))
          await db.folders.put(folder)
        }
        return folder
      },

      updateFolder: async (id, data) => {
        const folder = await apiUpdateFolder(id, data)
        if (folder) {
          set((state) => ({
            folders: state.folders.map(f => f.id === id ? folder : f)
          }))
          await db.folders.put(folder)
          return true
        }
        return false
      },

      deleteFolder: async (id) => {
        const success = await apiDeleteFolder(id)
        if (success) {
          set((state) => {
            const { [id]: _removed, ...restPrefs } = state.uiPrefs
            return {
              folders: state.folders.map(f =>
                f.id === id ? { ...f, deleted: true } : f
              ),
              uiPrefs: restPrefs
            }
          })
          await db.folders.update(id, { deleted: true })
        }
        return success
      },

      createKeyword: async (keyword) => {
        const kw = await apiCreateKeyword(keyword)
        if (kw) {
          set((state) => ({
            keywords: [...state.keywords, kw]
          }))
          await db.keywords.put(kw)
        }
        return kw
      },

      addKeywordToFolder: async (folderId, keywordId) => {
        const success = await apiLinkKeywordToFolder(folderId, keywordId)
        if (success) {
          const link: FolderKeywordLink = { folder_id: folderId, keyword_id: keywordId }
          set((state) => {
            const exists = state.folderKeywordLinks.some(
              (l) => l.folder_id === link.folder_id && l.keyword_id === link.keyword_id
            )
            return exists ? state : { folderKeywordLinks: [...state.folderKeywordLinks, link] }
          })
          await db.folderKeywordLinks.put(link)
        }
        return success
      },

      addConversationToFolder: async (conversationId, folderId) => {
        const state = get()
        // Find a keyword associated with this folder, or create one
        let keyword = state.keywords.find(k =>
          state.folderKeywordLinks.some(l =>
            l.folder_id === folderId && l.keyword_id === k.id
          )
        )

        let createdKeywordForFolder = false

        if (!keyword) {
          // Create a keyword with the folder name
          const folder = state.folders.find(f => f.id === folderId)
          if (!folder) return false
          keyword = await get().createKeyword(folder.name)
          if (!keyword) return false
          createdKeywordForFolder = true

          const linked = await get().addKeywordToFolder(folderId, keyword.id)
          if (!linked) {
            if (createdKeywordForFolder) {
              await apiDeleteKeyword(keyword.id)
              set((state) => ({
                keywords: state.keywords.map((k) =>
                  k.id === keyword!.id ? { ...k, deleted: true } : k
                )
              }))
              await db.keywords.update(keyword.id, { deleted: true })
            }
            return false
          }
        }

        const success = await apiLinkKeywordToConversation(conversationId, keyword.id)
        if (success) {
          const link: ConversationKeywordLink = {
            conversation_id: conversationId,
            keyword_id: keyword.id
          }
          set((state) => {
            const exists = state.conversationKeywordLinks.some(
              (l) => l.conversation_id === link.conversation_id && l.keyword_id === link.keyword_id
            )
            return exists
              ? state
              : { conversationKeywordLinks: [...state.conversationKeywordLinks, link] }
          })
          await db.conversationKeywordLinks.put(link)
        }
        return success
      },

      removeConversationFromFolder: async (conversationId, folderId) => {
        const state = get()
        // Find keywords associated with this folder
        const folderKeywordIds = new Set(
          state.folderKeywordLinks
            .filter(l => l.folder_id === folderId)
            .map(l => l.keyword_id)
        )

        // Find which of these keywords are linked to the conversation
        const linksToRemove = state.conversationKeywordLinks.filter(l =>
          l.conversation_id === conversationId &&
          folderKeywordIds.has(l.keyword_id)
        )

        let success = true
        const removedLinks: ConversationKeywordLink[] = []
        for (const link of linksToRemove) {
          const result = await apiUnlinkKeywordFromConversation(conversationId, link.keyword_id)
          if (result) {
            removedLinks.push(link)
            await db.conversationKeywordLinks
              .where('[conversation_id+keyword_id]')
              .equals([link.conversation_id, link.keyword_id])
              .delete()
          } else {
            success = false
          }
        }

        if (removedLinks.length > 0) {
          const removedKeySet = new Set(
            removedLinks.map(
              (r) => `${r.conversation_id}::${r.keyword_id}`
            )
          )

          set((state) => ({
            conversationKeywordLinks: state.conversationKeywordLinks.filter(
              (l) => !removedKeySet.has(`${l.conversation_id}::${l.keyword_id}`)
            )
          }))
        }

        return success
      },

      // Computed helpers
      getFolderTree: () => {
        const state = get()
        return buildFolderTree(
          state.folders,
          state.keywords,
          state.folderKeywordLinks,
          state.conversationKeywordLinks
        )
      },

      getKeywordsForFolder: (folderId) => {
        const state = get()
        const keywordIds = state.folderKeywordLinks
          .filter(l => l.folder_id === folderId)
          .map(l => l.keyword_id)
        return state.keywords.filter(k => keywordIds.includes(k.id) && !k.deleted)
      },

      getFoldersForConversation: (conversationId) => {
        const state = get()
        // Get keyword IDs for this conversation
        const keywordIds = state.conversationKeywordLinks
          .filter(l => l.conversation_id === conversationId)
          .map(l => l.keyword_id)

        // Get folder IDs that contain these keywords
        const folderIds = new Set(
          state.folderKeywordLinks
            .filter(l => keywordIds.includes(l.keyword_id))
            .map(l => l.folder_id)
        )

        return state.folders.filter(f => folderIds.has(f.id) && !f.deleted)
      },

      getConversationsForFolder: (folderId) => {
        const state = get()
        // Get keyword IDs for this folder
        const keywordIds = state.folderKeywordLinks
          .filter(l => l.folder_id === folderId)
          .map(l => l.keyword_id)

        // Get conversation IDs that have these keywords
        const conversationIds = new Set(
          state.conversationKeywordLinks
            .filter(l => keywordIds.includes(l.keyword_id))
            .map(l => l.conversation_id)
        )

        return Array.from(conversationIds)
      }
    }),
    {
      name: 'tldw-folder-store',
      // Only persist UI preferences, not server data
      partialize: (state) => ({
        uiPrefs: state.uiPrefs,
        viewMode: state.viewMode
      })
    }
  )
)

// ─────────────────────────────────────────────────────────────────────────────
// Selectors (for performance - avoid re-renders)
// ─────────────────────────────────────────────────────────────────────────────

export const useFolders = () => useFolderStore((s) => s.folders)
export const useKeywords = () => useFolderStore((s) => s.keywords)
export const useFolderViewMode = () => useFolderStore((s) => s.viewMode)
export const useFolderIsLoading = () => useFolderStore((s) => s.isLoading)
export const useFolderUIPrefs = () => useFolderStore((s) => s.uiPrefs)

export const useFolderActions = () =>
  useFolderStore(
    useShallow((s) => ({
      setViewMode: s.setViewMode,
      toggleFolderOpen: s.toggleFolderOpen,
      expandAllFolders: s.expandAllFolders,
      collapseAllFolders: s.collapseAllFolders,
      refreshFromServer: s.refreshFromServer,
      createFolder: s.createFolder,
      updateFolder: s.updateFolder,
      deleteFolder: s.deleteFolder,
      addConversationToFolder: s.addConversationToFolder,
      removeConversationFromFolder: s.removeConversationFromFolder
    }))
  )

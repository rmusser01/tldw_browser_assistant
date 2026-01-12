import React from 'react'
import type { InputRef } from 'antd'
import { Input, Typography, Select, Button, Tooltip } from 'antd'
import { Plus as PlusIcon, Search as SearchIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { bgRequest } from '@/services/background-proxy'
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { useServerOnline } from '@/hooks/useServerOnline'
import { useConfirmDanger } from '@/components/Common/confirm-danger'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import FeatureEmptyState from '@/components/Common/FeatureEmptyState'
import { useDemoMode } from '@/context/demo-mode'
import { useServerCapabilities } from '@/hooks/useServerCapabilities'
import { tldwClient } from '@/services/tldw/TldwApiClient'
import { useAntdMessage } from '@/hooks/useAntdMessage'
import { getAllNoteKeywords, searchNoteKeywords } from "@/services/note-keywords"
import { useStoreMessageOption } from "@/store/option"
import { shallow } from "zustand/shallow"
import { updatePageTitle } from "@/utils/update-page-title"
import { normalizeChatRole } from "@/utils/normalize-chat-role"
import { useScrollToServerCard } from "@/hooks/useScrollToServerCard"
import { MarkdownPreview } from "@/components/Common/MarkdownPreview"
import NotesEditorHeader from "@/components/Notes/NotesEditorHeader"
import NotesListPanel from "@/components/Notes/NotesListPanel"
import type { NoteListItem } from "@/components/Notes/types"
import { translateMessage } from "@/i18n/translateMessage"
import { formatFileSize } from "@/utils/format"
import { clearSetting, getSetting } from "@/services/settings/registry"
import { LAST_NOTE_ID_SETTING } from "@/services/settings/ui-settings"

type NoteWithKeywords = {
  metadata?: { keywords?: any[] }
  keywords?: any[]
}

const KeywordPickerModal = React.lazy(() => import('@/components/Notes/KeywordPickerModal'))

const extractBacklink = (note: any) => {
  const meta = note?.metadata || {}
  const backlinks = meta?.backlinks || meta || {}
  const conversation =
    note?.conversation_id ??
    backlinks?.conversation_id ??
    backlinks?.conversationId ??
    meta?.conversation_id ??
    null
  const message =
    note?.message_id ??
    backlinks?.message_id ??
    backlinks?.messageId ??
    meta?.message_id ??
    null
  return {
    conversation_id: conversation != null ? String(conversation) : null,
    message_id: message != null ? String(message) : null
  }
}

const extractKeywords = (note: NoteWithKeywords | any): string[] => {
  const rawKeywords = (Array.isArray(note?.metadata?.keywords)
    ? note.metadata.keywords
    : Array.isArray(note?.keywords)
      ? note.keywords
      : []) as any[]
  return (rawKeywords || [])
    .map((item: any) => {
      const raw =
        item?.keyword ??
        item?.keyword_text ??
        item?.text ??
        item
      return typeof raw === 'string' ? raw : null
    })
    .filter((s): s is string => !!s && s.trim().length > 0)
}

// Extract version from note object. Checks multiple candidate fields in order:
// 1. note.version (primary)
// 2. note.expected_version (fallback)
// 3. note.expectedVersion (camelCase variant)
// 4. note.metadata.* (nested variants)
const toNoteVersion = (note: any): number | null => {
  const candidates = [
    note?.version,
    note?.expected_version,
    note?.expectedVersion,
    note?.metadata?.version,
    note?.metadata?.expected_version,
    note?.metadata?.expectedVersion
  ]
  const validVersions: number[] = []
  for (const candidate of candidates) {
    if (
      typeof candidate === 'number' &&
      Number.isFinite(candidate) &&
      Number.isInteger(candidate) &&
      candidate >= 0
    ) {
      validVersions.push(candidate)
    }
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const parsed = Number(candidate)
      if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0) {
        validVersions.push(parsed)
      }
    }
  }
  if (validVersions.length > 1) {
    const allSame = validVersions.every((version) => version === validVersions[0])
    if (!allSame) {
      console.warn('[toNoteVersion] Multiple conflicting versions found:', validVersions)
    }
  }
  return validVersions[0] ?? null
}

// 120px offset accounts for page header and padding
const MIN_SIDEBAR_HEIGHT = 600
const calculateSidebarHeight = () => {
  const vh = typeof window !== 'undefined' ? window.innerHeight : MIN_SIDEBAR_HEIGHT
  return Math.max(MIN_SIDEBAR_HEIGHT, vh - 120)
}

const NotesManagerPage: React.FC = () => {
  const { t } = useTranslation(['option', 'common'])
  const [query, setQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)
  const [total, setTotal] = React.useState(0)
  const [selectedId, setSelectedId] = React.useState<string | number | null>(null)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [loadingDetail, setLoadingDetail] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [keywordTokens, setKeywordTokens] = React.useState<string[]>([])
  const [keywordOptions, setKeywordOptions] = React.useState<string[]>([])
  const [allKeywords, setAllKeywords] = React.useState<string[]>([])
  const [keywordPickerOpen, setKeywordPickerOpen] = React.useState(false)
  const [keywordPickerQuery, setKeywordPickerQuery] = React.useState('')
  const [keywordPickerSelection, setKeywordPickerSelection] = React.useState<string[]>([])
  const [editorKeywords, setEditorKeywords] = React.useState<string[]>([])
  const [originalMetadata, setOriginalMetadata] = React.useState<Record<string, any> | null>(null)
  const [selectedVersion, setSelectedVersion] = React.useState<number | null>(null)
  const [isDirty, setIsDirty] = React.useState(false)
  const [backlinkConversationId, setBacklinkConversationId] = React.useState<string | null>(null)
  const [backlinkMessageId, setBacklinkMessageId] = React.useState<string | null>(null)
  const [openingLinkedChat, setOpeningLinkedChat] = React.useState(false)
  const [showPreview, setShowPreview] = React.useState(false)
  const keywordSearchTimeoutRef = React.useRef<number | null>(null)
  const isOnline = useServerOnline()
  const { demoEnabled } = useDemoMode()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const titleInputRef = React.useRef<InputRef | null>(null)
  const message = useAntdMessage()
  const confirmDanger = useConfirmDanger()
  const {
    setHistory,
    setMessages,
    setHistoryId,
    setServerChatId,
    setServerChatState,
    setServerChatTopic,
    setServerChatClusterId,
    setServerChatSource,
    setServerChatExternalRef
  } = useStoreMessageOption(
    (state) => ({
      setHistory: state.setHistory,
      setMessages: state.setMessages,
      setHistoryId: state.setHistoryId,
      setServerChatId: state.setServerChatId,
      setServerChatState: state.setServerChatState,
      setServerChatTopic: state.setServerChatTopic,
      setServerChatClusterId: state.setServerChatClusterId,
      setServerChatSource: state.setServerChatSource,
      setServerChatExternalRef: state.setServerChatExternalRef
    }),
    shallow
  )

  const editorDisabled = !isOnline || (!capsLoading && capabilities && !capabilities.hasNotes)

  const fetchFilteredNotesRaw = async (
    q: string,
    toks: string[],
    page: number,
    pageSize: number
  ): Promise<{ items: any[]; total: number }> => {
    const qstr = q.trim()
    if (!qstr && toks.length === 0) {
      return { items: [], total: 0 }
    }

    const params = new URLSearchParams()
    if (qstr) params.set('query', qstr)
    params.set('limit', String(pageSize))
    params.set('offset', String((page - 1) * pageSize))
    params.set('include_keywords', 'true')
    toks.forEach((tok) => {
      const v = tok.trim()
      if (v.length > 0) {
        params.append('tokens', v)
      }
    })

    const abs = await bgRequest<any>({
      path: `/api/v1/notes/search/?${params.toString()}` as any,
      method: 'GET' as any
    })

    let items: any[] = []
    let total = 0

    if (Array.isArray(abs)) {
      items = abs
      total = abs.length
    } else if (abs && typeof abs === 'object') {
      if (Array.isArray((abs as any).items)) {
        items = (abs as any).items
      }
      const pagination = (abs as any).pagination
      if (pagination && typeof pagination.total_items === 'number') {
        total = Number(pagination.total_items)
      } else if (Array.isArray((abs as any).items)) {
        total = (abs as any).items.length
      }
    }

    return { items, total }
  }

  const fetchNotes = async (): Promise<NoteListItem[]> => {
    const q = query.trim()
    const toks = keywordTokens.map((k) => k.toLowerCase())
    // Prefer search when query or keyword filters are present
    if (q || toks.length > 0) {
      const { items, total } = await fetchFilteredNotesRaw(q, toks, page, pageSize)
      setTotal(total)
      return items.map((n: any) => {
        const links = extractBacklink(n)
        const keywords = extractKeywords(n)
        return {
          id: n?.id,
          title: n?.title,
          content: n?.content,
          updated_at: n?.updated_at,
          conversation_id: links.conversation_id,
          message_id: links.message_id,
          keywords,
          version: toNoteVersion(n) ?? undefined
        }
      })
    }
    // Browse list with pagination when no filters
    const res = await bgRequest<any>({ path: `/api/v1/notes/?page=${page}&results_per_page=${pageSize}` as any, method: 'GET' as any })
    const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : [])
    const pagination = res?.pagination
    setTotal(Number(pagination?.total_items || items.length || 0))
    return items.map((n: any) => {
      const links = extractBacklink(n)
      const keywords = extractKeywords(n)
      return {
        id: n?.id,
        title: n?.title,
        content: n?.content,
        updated_at: n?.updated_at,
        conversation_id: links.conversation_id,
        message_id: links.message_id,
        keywords,
        version: toNoteVersion(n) ?? undefined
      }
    })
  }

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['notes', query, page, pageSize, keywordTokens.join('|')],
    queryFn: fetchNotes,
    placeholderData: keepPreviousData,
    enabled: isOnline
  })

  const filteredCount = Array.isArray(data) ? data.length : 0
  const hasActiveFilters = query.trim().length > 0 || keywordTokens.length > 0

  const availableKeywords = React.useMemo(() => {
    const base = allKeywords.length ? allKeywords : keywordOptions
    const seen = new Set<string>()
    const out: string[] = []
    const add = (value: string) => {
      const text = String(value || '').trim()
      if (!text) return
      const key = text.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      out.push(text)
    }
    base.forEach(add)
    keywordTokens.forEach(add)
    return out
  }, [allKeywords, keywordOptions, keywordTokens])

  const filteredKeywordPickerOptions = React.useMemo(() => {
    const q = keywordPickerQuery.trim().toLowerCase()
    if (!q) return availableKeywords
    return availableKeywords.filter((kw) => kw.toLowerCase().includes(q))
  }, [availableKeywords, keywordPickerQuery])

  const loadAllKeywords = React.useCallback(async () => {
    // Cached for session; add a refresh/TTL if keyword updates become frequent.
    if (allKeywords.length > 0) return
    try {
      const arr = await getAllNoteKeywords()
      setAllKeywords(arr)
      setKeywordOptions(arr)
    } catch {
      console.debug('[NotesManagerPage] Keyword suggestions load failed')
    }
  }, [allKeywords])

  const openKeywordPicker = React.useCallback(() => {
    setKeywordPickerQuery('')
    setKeywordPickerSelection(keywordTokens)
    setKeywordPickerOpen(true)
    void loadAllKeywords()
  }, [keywordTokens, loadAllKeywords])

  const handleKeywordPickerCancel = React.useCallback(() => {
    setKeywordPickerOpen(false)
  }, [])

  const handleKeywordPickerApply = React.useCallback(() => {
    setKeywordTokens(keywordPickerSelection)
    setPage(1)
    setKeywordPickerOpen(false)
  }, [keywordPickerSelection])

  const handleKeywordPickerQueryChange = React.useCallback((value: string) => {
    setKeywordPickerQuery(value)
  }, [])

  const handleKeywordPickerSelectionChange = React.useCallback((vals: string[]) => {
    setKeywordPickerSelection(vals)
  }, [])

  const handleKeywordPickerSelectAll = React.useCallback(() => {
    setKeywordPickerSelection(availableKeywords)
  }, [availableKeywords])

  const handleKeywordPickerClear = React.useCallback(() => {
    setKeywordPickerSelection([])
  }, [])

  const loadDetail = React.useCallback(async (id: string | number) => {
    setLoadingDetail(true)
    try {
      const d = await bgRequest<any>({ path: `/api/v1/notes/${id}` as any, method: 'GET' as any })
      setSelectedId(id)
      setTitle(String(d?.title || ''))
      setContent(String(d?.content || ''))
      setEditorKeywords(extractKeywords(d))
      setSelectedVersion(toNoteVersion(d))
      const rawMeta = d && typeof d === "object" ? (d as any).metadata : null
      setOriginalMetadata(
        rawMeta && typeof rawMeta === "object" ? { ...(rawMeta as Record<string, any>) } : null
      )
      const links = extractBacklink(d)
      setBacklinkConversationId(links.conversation_id)
      setBacklinkMessageId(links.message_id)
      setIsDirty(false)
    } catch {
      message.error('Failed to load note')
    } finally { setLoadingDetail(false) }
  }, [])

  const resetEditor = () => {
    setSelectedId(null)
    setTitle('')
    setContent('')
    setEditorKeywords([])
    setOriginalMetadata(null)
    setSelectedVersion(null)
    setBacklinkConversationId(null)
    setBacklinkMessageId(null)
    setIsDirty(false)
  }

  const confirmDiscardIfDirty = React.useCallback(async () => {
    if (!isDirty) return true
    const ok = await confirmDanger({
      title: 'Discard changes?',
      content: 'You have unsaved changes. Discard them?',
      okText: 'Discard',
      cancelText: 'Cancel'
    })
    return ok
  }, [isDirty])

  const handleNewNote = React.useCallback(async () => {
    const ok = await confirmDiscardIfDirty()
    if (!ok) return
    resetEditor()
    setTimeout(() => {
      titleInputRef.current?.focus()
    }, 0)
  }, [confirmDiscardIfDirty])

  const handleSelectNote = React.useCallback(
    async (id: string | number) => {
      const ok = await confirmDiscardIfDirty()
      if (!ok) return
      await loadDetail(id)
    },
    [confirmDiscardIfDirty, loadDetail]
  )

  const isVersionConflictError = (error: any) => {
    const msg = String(error?.message || '')
    const lower = msg.toLowerCase()
    const status = error?.status ?? error?.response?.status
    return (
      status === 409 ||
      lower.includes('expected-version') ||
      lower.includes('expected_version') ||
      lower.includes('version mismatch')
    )
  }

  const handleVersionConflict = (noteId?: string | number | null) => {
    message.error({
      content: (
        <span
          className="inline-flex items-center gap-2"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              void reloadNotes(noteId)
            }
          }}
        >
          <span>This note changed on the server.</span>
          <Button
            type="link"
            size="small"
            onClick={() => void reloadNotes(noteId)}
            aria-label="Reload notes"
          >
            Reload notes
          </Button>
        </span>
      ),
      duration: 6
    })
  }

  const saveNote = async () => {
    if (!content.trim() && !title.trim()) { message.warning('Nothing to save'); return }
    setSaving(true)
    try {
      const metadata: Record<string, any> = {
        ...(originalMetadata || {}),
        keywords: editorKeywords
      }
      if (backlinkConversationId) metadata.conversation_id = backlinkConversationId
      if (backlinkMessageId) metadata.message_id = backlinkMessageId
      const payload: Record<string, any> = {
        title: title || undefined,
        content,
        metadata,
        keywords: editorKeywords
      }
      if (backlinkConversationId) payload.conversation_id = backlinkConversationId
      if (backlinkMessageId) payload.message_id = backlinkMessageId
      if (selectedId == null) {
        const created = await bgRequest<any>({ path: '/api/v1/notes/' as any, method: 'POST' as any, headers: { 'Content-Type': 'application/json' }, body: payload })
        message.success('Note created')
        setIsDirty(false)
        await refetch()
        if (created?.id != null) await loadDetail(created.id)
      } else {
        let expectedVersion = selectedVersion
        if (expectedVersion == null) {
          try {
            const latest = await bgRequest<any>({ path: `/api/v1/notes/${selectedId}` as any, method: 'GET' as any })
            expectedVersion = toNoteVersion(latest)
          } catch (e: any) {
            message.error(e?.message || 'Save failed')
            return
          }
        }
        if (expectedVersion == null) {
          message.error('Missing version; reload and try again')
          return
        }
        const updated = await bgRequest<any>({
          path: `/api/v1/notes/${selectedId}?expected_version=${encodeURIComponent(
            String(expectedVersion)
          )}` as any,
          method: 'PUT' as any,
          headers: { 'Content-Type': 'application/json' },
          body: payload
        })
        const updatedVersion = toNoteVersion(updated)
        message.success('Note updated')
        setIsDirty(false)
        await refetch()
        if (updatedVersion != null) {
          setSelectedVersion(updatedVersion)
        } else if (selectedId != null) {
          try {
            const latest = await bgRequest<any>({ path: `/api/v1/notes/${selectedId}` as any, method: 'GET' as any })
            setSelectedVersion(toNoteVersion(latest))
          } catch (err) {
            console.debug('[NotesManagerPage] Version refresh after save failed:', err)
          }
        }
      }
    } catch (e: any) {
      if (isVersionConflictError(e)) {
        handleVersionConflict(selectedId)
      } else {
        message.error(String(e?.message || '') || 'Operation failed')
      }
    } finally { setSaving(false) }
  }

  const reloadNotes = async (noteId?: string | number | null) => {
    await refetch()
    const target = noteId ?? selectedId
    if (target == null) return
    try {
      const detail = await bgRequest<any>({ path: `/api/v1/notes/${target}` as any, method: 'GET' as any })
      const version = toNoteVersion(detail)
      if (version != null) setSelectedVersion(version)
    } catch {
      // Ignore refresh errors for reload action; list refresh already happened.
    }
  }

  const deleteNote = async (id?: string | number | null) => {
    const target = id ?? selectedId
    if (target == null) { message.warning('No note selected'); return }
    const ok = await confirmDanger({ title: 'Please confirm', content: 'Delete this note?', okText: 'Delete', cancelText: 'Cancel' })
    if (!ok) return
    try {
      const targetId = String(target)
      let expectedVersion: number | null = null
      if (selectedId != null && String(selectedId) === targetId) {
        expectedVersion = selectedVersion
      }
      if (expectedVersion == null && Array.isArray(data)) {
        const match = data.find((note) => String(note.id) === targetId)
        if (typeof match?.version === 'number') expectedVersion = match.version
      }
      if (expectedVersion == null) {
        try {
          const detail = await bgRequest<any>({ path: `/api/v1/notes/${target}` as any, method: 'GET' as any })
          expectedVersion = toNoteVersion(detail)
        } catch (e: any) {
          message.error(e?.message || 'Delete failed')
          return
        }
      }
      if (expectedVersion == null) {
        message.error('Missing version; reload and try again')
        return
      }
      await bgRequest<any>({
        path: `/api/v1/notes/${target}?expected_version=${encodeURIComponent(
          String(expectedVersion)
        )}` as any,
        method: 'DELETE' as any
      })
      message.success('Note deleted')
      if (selectedId != null && String(selectedId) === targetId) resetEditor()
      await refetch()
    } catch (e: any) {
      if (isVersionConflictError(e)) {
        handleVersionConflict(target)
      } else {
        message.error(String(e?.message || '') || 'Operation failed')
      }
    }
  }

  const openLinkedConversation = async () => {
    // Check for unsaved changes before navigating
    const okToLeave = await confirmDiscardIfDirty()
    if (!okToLeave) return

    if (!backlinkConversationId) {
      message.warning(
        t("option:notesSearch.noLinkedConversation", {
          defaultValue: "No linked conversation to open."
        })
      )
      return
    }
    try {
      setOpeningLinkedChat(true)
      await tldwClient.initialize().catch(() => null)
      const chat = await tldwClient.getChat(backlinkConversationId)
      setHistoryId(null)
      setServerChatId(String(backlinkConversationId))
      setServerChatState(
        (chat as any)?.state ??
          (chat as any)?.conversation_state ??
          "in-progress"
      )
      setServerChatTopic((chat as any)?.topic_label ?? null)
      setServerChatClusterId((chat as any)?.cluster_id ?? null)
      setServerChatSource((chat as any)?.source ?? null)
      setServerChatExternalRef((chat as any)?.external_ref ?? null)
      let assistantName = "Assistant"
      if ((chat as any)?.character_id != null) {
        try {
          const c = await tldwClient.getCharacter((chat as any)?.character_id)
          assistantName =
            c?.name || c?.title || c?.slug || assistantName
        } catch {}
      }

      const messages = await tldwClient.listChatMessages(
        backlinkConversationId,
        { include_deleted: "false" } as any
      )
      const historyArr = messages.map((m) => ({
        role: normalizeChatRole(m.role),
        content: m.content
      }))
      const mappedMessages = messages.map((m) => {
        const createdAt = Date.parse(m.created_at)
        const normalizedRole = normalizeChatRole(m.role)
        return {
          createdAt: Number.isNaN(createdAt) ? undefined : createdAt,
          isBot: normalizedRole === "assistant",
          role: normalizedRole,
          name:
            normalizedRole === "assistant"
              ? assistantName
              : normalizedRole === "system"
                ? "System"
                : "You",
          message: m.content,
          sources: [],
          images: [],
          serverMessageId: m.id,
          serverMessageVersion: m.version
        }
      })
      setHistory(historyArr)
      setMessages(mappedMessages)
      updatePageTitle((chat as any)?.title || "")
      navigate("/")
      setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent("tldw:focus-composer"))
        } catch {}
      }, 0)
    } catch (e: any) {
      message.error(
        e?.message ||
          t("option:notesSearch.openConversationError", {
            defaultValue: "Failed to open linked conversation."
          })
      )
    } finally {
      setOpeningLinkedChat(false)
    }
  }

  const copySelected = async () => {
    try {
      await navigator.clipboard.writeText(content || '')
      message.success('Copied')
    } catch { message.error('Copy failed') }
  }

  const exportSelected = () => {
    const name = (title || `note-${selectedId ?? 'new'}`).replace(/[^a-z0-9-_]+/gi, '-')
    const md = title ? `# ${title}\n\n${content || ''}` : (content || '')
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.md`
    a.click()
    URL.revokeObjectURL(url)
    // Show file size in success message (KB/MB)
    const sizeDisplay = formatFileSize(blob.size)
    message.success(
      translateMessage(
        t,
        'option:notesSearch.exportNoteSuccess',
        'Exported ({{size}})',
        { size: sizeDisplay }
      )
    )
  }

  const MAX_EXPORT_PAGES = 1000

  const exportAll = async () => {
    try {
      let arr: NoteListItem[] = []
      const q = query.trim()
      const toks = keywordTokens.map((k) => k.toLowerCase())
      if (q || toks.length > 0) {
        // Fetch all matching notes in chunks using server-side filtering
        let p = 1
        const ps = 100
        while (p <= MAX_EXPORT_PAGES) {
          const { items } = await fetchFilteredNotesRaw(q, toks, p, ps)
          if (!items.length) break
          arr.push(
            ...items.map((n: any) => ({
              id: n?.id,
              title: n?.title,
              content: n?.content
            }))
          )
          if (items.length < ps) break
          p++
        }
      } else {
        // Iterate pages (chunk by 100)
        let p = 1
        const ps = 100
        while (p <= MAX_EXPORT_PAGES) {
          const res = await bgRequest<any>({ path: `/api/v1/notes/?page=${p}&results_per_page=${ps}` as any, method: 'GET' as any })
          const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : [])
          arr.push(...items.map((n: any) => ({ id: n?.id, title: n?.title, content: n?.content })))
          const pagination = res?.pagination
          const totalPages = Number(pagination?.total_pages || (items.length < ps ? p : p + 1))
          if (p >= totalPages || items.length === 0) break
          p++
        }
      }
      if (arr.length === 0) { message.info('No notes to export'); return }
      const md = arr.map((n, idx) => `### ${n.title || `Note ${n.id ?? idx+1}`}\n\n${String(n.content || '')}`).join("\n\n---\n\n")
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `notes-export.md`
      a.click()
      URL.revokeObjectURL(url)
      // Format file size for success message
      const sizeDisplay = formatFileSize(blob.size)
      message.success(
        translateMessage(
          t,
          'option:notesSearch.exportSuccess',
          'Exported {{count}} notes ({{size}})',
          { count: arr.length, size: sizeDisplay }
        )
      )
    } catch (e: any) {
      message.error(e?.message || 'Export failed')
    }
  }

  const gatherAllMatching = async (): Promise<NoteListItem[]> => {
    let arr: NoteListItem[] = []
    const q = query.trim()
    const toks = keywordTokens.map((k) => k.toLowerCase())
    if (q || toks.length > 0) {
      // Fetch all matching notes in chunks using server-side filtering
      let p = 1
      const ps = 100
      while (p <= MAX_EXPORT_PAGES) {
        const { items } = await fetchFilteredNotesRaw(q, toks, p, ps)
        if (!items.length) break
        arr.push(
          ...items.map((n: any) => ({
            id: n?.id,
            title: n?.title,
            content: n?.content,
            updated_at: n?.updated_at,
            keywords: extractKeywords(n)
          }))
        )
        if (items.length < ps) break
        p++
      }
    } else {
      // Iterate pages (chunk by 100)
      let p = 1
      const ps = 100
      while (p <= MAX_EXPORT_PAGES) {
        const res = await bgRequest<any>({ path: `/api/v1/notes/?page=${p}&results_per_page=${ps}` as any, method: 'GET' as any })
        const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : [])
        arr.push(
          ...items.map((n: any) => ({
            id: n?.id,
            title: n?.title,
            content: n?.content,
            updated_at: n?.updated_at,
            keywords: extractKeywords(n)
          }))
        )
        const pagination = res?.pagination
        const totalPages = Number(pagination?.total_pages || (items.length < ps ? p : p + 1))
        if (p >= totalPages || items.length === 0) break
        p++
      }
    }
    return arr
  }

  const exportAllCSV = async () => {
    try {
      const arr = await gatherAllMatching()
      if (!arr.length) { message.info('No notes to export'); return }
      const escape = (s: any) => '"' + String(s ?? '').replace(/"/g, '""') + '"'
      const header = ['id','title','content','updated_at','keywords']
      const rows = [
        header.join(','),
        ...arr.map((n) =>
          [
            n.id,
            n.title || '',
            (n.content || '').replace(/\r?\n/g, '\\n'),
            n.updated_at || '',
            (n.keywords || []).join('; ')
          ]
            .map(escape)
            .join(',')
        )
      ]
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `notes-export.csv`
      a.click()
      URL.revokeObjectURL(url)
      const sizeDisplay = formatFileSize(blob.size)
      message.success(
        translateMessage(
          t,
          'option:notesSearch.exportCsvSuccess',
          'Exported {{count}} notes as CSV ({{size}})',
          { count: arr.length, size: sizeDisplay }
        )
      )
    } catch (e: any) {
      message.error(e?.message || 'Export failed')
    }
  }

  const exportAllJSON = async () => {
    try {
      const arr = await gatherAllMatching()
      if (!arr.length) { message.info('No notes to export'); return }
      const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `notes-export.json`
      a.click()
      URL.revokeObjectURL(url)
      const sizeDisplay = formatFileSize(blob.size)
      message.success(
        translateMessage(
          t,
          'option:notesSearch.exportJsonSuccess',
          'Exported {{count}} notes as JSON ({{size}})',
          { count: arr.length, size: sizeDisplay }
        )
      )
    } catch (e: any) {
      message.error(e?.message || 'Export failed')
    }
  }

  const loadKeywordSuggestions = React.useCallback(async (text?: string) => {
    try {
      if (text && text.trim().length > 0) {
        const arr = await searchNoteKeywords(text, 10)
        setKeywordOptions(arr)
      } else if (allKeywords.length > 0) {
        setKeywordOptions(allKeywords)
      }
    } catch {
      // Keyword load failed - feature will use empty suggestions
      console.debug('[NotesManagerPage] Keyword suggestions load failed')
    }
  }, [allKeywords])

  const debouncedLoadKeywordSuggestions = React.useCallback(
    (text?: string) => {
      if (typeof window === 'undefined') {
        void loadKeywordSuggestions(text)
        return
      }
      if (keywordSearchTimeoutRef.current != null) {
        window.clearTimeout(keywordSearchTimeoutRef.current)
      }
      keywordSearchTimeoutRef.current = window.setTimeout(() => {
        void loadKeywordSuggestions(text)
      }, 300)
    },
    [loadKeywordSuggestions]
  )

  const handleKeywordFilterSearch = React.useCallback(
    (text: string) => {
      if (isOnline) void debouncedLoadKeywordSuggestions(text)
    },
    [debouncedLoadKeywordSuggestions, isOnline]
  )

  const handleKeywordFilterChange = React.useCallback(
    (vals: string[] | string) => {
      setKeywordTokens(Array.isArray(vals) ? vals : [vals])
      setPage(1)
    },
    []
  )

  const handleClearFilters = React.useCallback(() => {
    setQuery('')
    setKeywordTokens([])
    setPage(1)
  }, [])

  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  React.useEffect(() => {
    return () => {
      if (keywordSearchTimeoutRef.current != null) {
        clearTimeout(keywordSearchTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    // When selecting a different note, default back to edit mode so users can start typing immediately.
    setShowPreview(false)
  }, [selectedId])

  // Deep-link support: if tldw:lastNoteId is set (e.g., from omni-search),
  // automatically load that note once when the list is available.
  const [pendingNoteId, setPendingNoteId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const lastNoteId = await getSetting(LAST_NOTE_ID_SETTING)
      if (!cancelled && lastNoteId) {
        setPendingNoteId(lastNoteId)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!isOnline) return
    if (!pendingNoteId) return
    if (!Array.isArray(data)) return
    if (selectedId != null) return

    ;(async () => {
      await handleSelectNote(pendingNoteId)
      setPendingNoteId(null)
      void clearSetting(LAST_NOTE_ID_SETTING)
    })()
  }, [data, handleSelectNote, isOnline, pendingNoteId, selectedId])

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

  const [sidebarHeight, setSidebarHeight] = React.useState(calculateSidebarHeight())

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handleResize = () => {
      setSidebarHeight(calculateSidebarHeight())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="flex h-full w-full bg-bg p-4 mt-16">
      {/* Collapsible Sidebar */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-[380px]'
        }`}
        style={{ minHeight: `${MIN_SIDEBAR_HEIGHT}px`, height: `${sidebarHeight}px` }}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
          {/* Toolbar Section */}
          <div className="flex-shrink-0 border-b border-border p-4 bg-surface">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-[0.16em] text-text-muted">
                {t('option:notesSearch.headerLabel', { defaultValue: 'Notes' })}
                <span className="ml-2 text-text-subtle">
                  {hasActiveFilters && filteredCount > 0 && total > 0
                    ? t('option:notesSearch.headerCount', {
                        defaultValue: '{{visible}} of {{total}}',
                        visible: filteredCount,
                        total
                      })
                    : t('option:notesSearch.headerCountFallback', {
                        defaultValue: '{{total}} total',
                        total
                      })}
                </span>
              </div>
              <Tooltip
                title={t('option:notesSearch.newTooltip', {
                  defaultValue: 'Create a new note'
                })}
              >
                <Button
                  type="text"
                  shape="circle"
                  onClick={() => void handleNewNote()}
                  className="flex items-center justify-center"
                  icon={(<PlusIcon className="w-4 h-4" />) as any}
                  aria-label={t('option:notesSearch.new', {
                    defaultValue: 'New note'
                  })}
                />
              </Tooltip>
            </div>
            <div className="space-y-2">
              <Input
                allowClear
                placeholder={t('option:notesSearch.placeholder', {
                  defaultValue: 'Search notes...'
                })}
                prefix={(<SearchIcon className="w-4 h-4 text-text-subtle" />) as any}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                onPressEnter={() => {
                  setPage(1)
                }}
              />
              <Select
                mode="tags"
                allowClear
                placeholder={t('option:notesSearch.keywordsPlaceholder', {
                  defaultValue: 'Filter by keyword'
                })}
                className="w-full"
                value={keywordTokens}
                onSearch={handleKeywordFilterSearch}
                onChange={handleKeywordFilterChange}
                options={keywordOptions.map((k) => ({ label: k, value: k }))}
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  size="small"
                  onClick={openKeywordPicker}
                  disabled={!isOnline}
                  className="text-xs"
                >
                  {t('option:notesSearch.keywordsBrowse', {
                    defaultValue: 'Browse keywords'
                  })}
                </Button>
                {availableKeywords.length > 0 && (
                  <Typography.Text
                    type="secondary"
                    className="text-[11px] text-text-muted"
                  >
                    {t('option:notesSearch.keywordsBrowseCount', {
                      defaultValue: '{{count}} available',
                      count: availableKeywords.length
                    })}
                  </Typography.Text>
                )}
              </div>
              {hasActiveFilters && (
                <Button
                  size="small"
                  onClick={handleClearFilters}
                  className="w-full text-xs"
                >
                  {t('option:notesSearch.clear', {
                    defaultValue: 'Clear search & filters'
                  })}
                </Button>
              )}
            </div>
          </div>

          {/* Notes List Section */}
          <div className="flex-1 overflow-y-auto">
            <NotesListPanel
              isOnline={isOnline}
              isFetching={isFetching}
              demoEnabled={demoEnabled}
              capsLoading={capsLoading}
              capabilities={capabilities || null}
              notes={Array.isArray(data) ? data : undefined}
              total={total}
              page={page}
              pageSize={pageSize}
              selectedId={selectedId}
              onSelectNote={(id) => {
                void handleSelectNote(id)
              }}
              onChangePage={(nextPage, nextPageSize) => {
                setPage(nextPage)
                setPageSize(nextPageSize)
              }}
              onResetEditor={resetEditor}
              onOpenSettings={() => navigate('/settings/tldw')}
              onOpenHealth={() => navigate('/settings/health')}
              onExportAllMd={() => {
                void exportAll()
              }}
              onExportAllCsv={() => {
                void exportAllCSV()
              }}
              onExportAllJson={() => {
                void exportAllJSON()
              }}
            />
          </div>
        </div>
      </div>

      {/* Collapse Button - Simple style like Media page */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="relative w-6 bg-surface border-y border-r border-border hover:bg-surface2 flex items-center justify-center group transition-colors rounded-r-lg"
        style={{ minHeight: `${MIN_SIDEBAR_HEIGHT}px`, height: `${sidebarHeight}px` }}
        aria-label={
          sidebarCollapsed
            ? t('option:notesSearch.expandSidebar', {
                defaultValue: 'Expand sidebar'
              })
            : t('option:notesSearch.collapseSidebar', {
                defaultValue: 'Collapse sidebar'
              })
        }
      >
        <div className="flex items-center justify-center w-full h-full">
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-text-subtle group-hover:text-text" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-text-subtle group-hover:text-text" />
          )}
        </div>
      </button>

      {/* Editor Panel */}
      <div
        className="flex-1 flex flex-col overflow-hidden rounded-lg border border-border bg-surface ml-4"
        aria-disabled={editorDisabled}
      >
        <NotesEditorHeader
          title={title}
          selectedId={selectedId}
          backlinkConversationId={backlinkConversationId}
          backlinkMessageId={backlinkMessageId}
          editorDisabled={editorDisabled}
          openingLinkedChat={openingLinkedChat}
          showPreview={showPreview}
          hasContent={content.trim().length > 0}
          canSave={
            !editorDisabled &&
            (title.trim().length > 0 || content.trim().length > 0)
          }
          canExport={Boolean(title || content)}
          isSaving={saving}
          canDelete={!editorDisabled && selectedId != null}
          isDirty={isDirty}
          onOpenLinkedConversation={() => {
            void openLinkedConversation()
          }}
          onNewNote={() => {
            void handleNewNote()
          }}
          onTogglePreview={() => {
            setShowPreview((prev) => !prev)
          }}
          onCopy={() => {
            void copySelected()
          }}
          onExport={exportSelected}
          onSave={() => {
            void saveNote()
          }}
          onDelete={() => {
            void deleteNote()
          }}
        />
        <div className="flex-1 flex flex-col px-4 py-3 overflow-auto">
          <Input
            placeholder={t('option:notesSearch.titlePlaceholder', {
              defaultValue: 'Title'
            })}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setIsDirty(true)
            }}
            disabled={editorDisabled}
            ref={titleInputRef}
            className="bg-transparent hover:bg-surface2 focus:bg-surface2 transition-colors"
          />
          <div className="mt-3">
            <Select
              mode="tags"
              allowClear
              placeholder={t('option:notesSearch.keywordsEditorPlaceholder', {
                defaultValue: 'Keywords (tags)'
              })}
              className="w-full"
              value={editorKeywords}
              onSearch={(txt) => {
                if (isOnline) void debouncedLoadKeywordSuggestions(txt)
              }}
              onChange={(vals) => {
                setEditorKeywords(vals as string[])
                setIsDirty(true)
              }}
              options={keywordOptions.map((k) => ({ label: k, value: k }))}
              disabled={editorDisabled}
            />
            <Typography.Text
              type="secondary"
              className="block text-[11px] mt-1 text-text-muted"
            >
              {t('option:notesSearch.tagsHelp', {
                defaultValue:
                  'Keywords help you find this note using the keyword filter on the left.'
              })}
            </Typography.Text>
          </div>
          <div className="mt-3 flex-1 min-h-0">
            {showPreview ? (
              content.trim().length > 0 ? (
                <div className="h-full flex flex-col">
                  <Typography.Text
                    type="secondary"
                    className="block text-[11px] mb-2 text-text-muted"
                  >
                    {t('option:notesSearch.previewTitle', {
                      defaultValue: 'Preview (Markdown + LaTeX)'
                    })}
                  </Typography.Text>
                  <div className="w-full flex-1 text-sm p-4 rounded-lg border border-border bg-surface2 overflow-auto">
                    <MarkdownPreview content={content} size="sm" />
                  </div>
                </div>
              ) : (
                <Typography.Text
                  type="secondary"
                  className="block text-[11px] mt-1 text-text-muted"
                >
                  {t('option:notesSearch.emptyPreview', {
                    defaultValue:
                      'Start typing to see a live preview of your note.'
                  })}
                </Typography.Text>
              )
            ) : (
              <textarea
                className="w-full h-full min-h-0 text-sm p-4 rounded-lg border border-border bg-surface2 text-text resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-focus"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  setIsDirty(true)
                }}
                placeholder={t('option:notesSearch.editorPlaceholder', {
                  defaultValue: 'Write your note here... (Markdown supported)'
                })}
                readOnly={editorDisabled}
              />
            )}
          </div>
        </div>
      </div>
      {keywordPickerOpen && (
        <React.Suspense fallback={null}>
          <KeywordPickerModal
            open={keywordPickerOpen}
            availableKeywords={availableKeywords}
            filteredKeywordPickerOptions={filteredKeywordPickerOptions}
            keywordPickerQuery={keywordPickerQuery}
            keywordPickerSelection={keywordPickerSelection}
            onCancel={handleKeywordPickerCancel}
            onApply={handleKeywordPickerApply}
            onQueryChange={handleKeywordPickerQueryChange}
            onSelectionChange={handleKeywordPickerSelectionChange}
            onSelectAll={handleKeywordPickerSelectAll}
            onClear={handleKeywordPickerClear}
            t={t}
          />
        </React.Suspense>
      )}
    </div>
  )
}

export default NotesManagerPage

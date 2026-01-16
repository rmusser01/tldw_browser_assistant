import { useState, useCallback, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Tabs, message, Spin, Empty, Button, Select, Modal, Input } from "antd"
import { Plus, Kanban, Upload, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  listBoards,
  getBoard,
  createBoard,
  deleteBoard,
  generateClientId
} from "@/services/kanban"
import { BoardView } from "./BoardView"
import { ImportPanel } from "./ImportPanel"

type PlaygroundTab = "board" | "import"

export const KanbanPlayground = () => {
  const { t } = useTranslation(["settings", "common"])
  const queryClient = useQueryClient()
  const debugEnabled = useMemo(() => {
    if (typeof window === "undefined") return false
    try {
      const href = window.location.href
      if (href.includes("e2e=1") || href.includes("e2e=true")) return true
      return new URLSearchParams(window.location.search).has("e2e")
    } catch {
      return false
    }
  }, [])

  const debugLog = useCallback(
    (message: string, data?: Record<string, unknown>) => {
      if (!debugEnabled) return
      if (data) {
        console.log(`[kanban-ui] ${message}`, data)
      } else {
        console.log(`[kanban-ui] ${message}`)
      }
    },
    [debugEnabled]
  )

  // Tab state
  const [activeTab, setActiveTab] = useState<PlaygroundTab>("board")

  // Board selection state
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)

  // Create board modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState("")

  // Fetch boards list
  const {
    data: boardsData,
    isLoading: boardsLoading,
    refetch: refetchBoards
  } = useQuery({
    queryKey: ["kanban-boards"],
    queryFn: () => listBoards({ limit: 100 }),
    staleTime: 60 * 1000
  })

  // Fetch selected board with lists and cards
  const {
    data: boardData,
    isLoading: boardLoading,
    refetch: refetchBoard
  } = useQuery({
    queryKey: ["kanban-board", selectedBoardId],
    queryFn: () => getBoard(selectedBoardId!),
    enabled: selectedBoardId !== null,
    staleTime: 30 * 1000
  })

  // Create board mutation
  const createBoardMutation = useMutation({
    mutationFn: (name: string) =>
      createBoard({ name, client_id: generateClientId() }),
    onSuccess: (newBoard) => {
      debugLog("createBoard:success", { boardId: newBoard.id })
      message.success("Board created")
      queryClient.invalidateQueries({ queryKey: ["kanban-boards"] })
      setSelectedBoardId(newBoard.id)
      setCreateModalOpen(false)
      setNewBoardName("")
    },
    onError: (err) => {
      debugLog("createBoard:error", {
        message: err instanceof Error ? err.message : "Unknown error"
      })
      message.error(`Failed to create board: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  })

  // Delete board mutation
  const deleteBoardMutation = useMutation({
    mutationFn: (boardId: number) => deleteBoard(boardId),
    onSuccess: () => {
      debugLog("deleteBoard:success")
      message.success("Board deleted")
      queryClient.invalidateQueries({ queryKey: ["kanban-boards"] })
      setSelectedBoardId(null)
    },
    onError: (err) => {
      debugLog("deleteBoard:error", {
        message: err instanceof Error ? err.message : "Unknown error"
      })
      message.error(`Failed to delete board: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  })

  const handleCreateBoard = useCallback(() => {
    if (!newBoardName.trim()) {
      message.warning("Please enter a board name")
      return
    }
    debugLog("createBoard:submit", { name: newBoardName.trim() })
    createBoardMutation.mutate(newBoardName.trim())
  }, [newBoardName, createBoardMutation, debugLog])

  const handleDeleteBoard = useCallback(() => {
    if (!selectedBoardId) return
    deleteBoardMutation.mutate(selectedBoardId)
  }, [selectedBoardId, deleteBoardMutation])

  const handleBoardImported = useCallback((boardId: number) => {
    queryClient.invalidateQueries({ queryKey: ["kanban-boards"] })
    setSelectedBoardId(boardId)
    setActiveTab("board")
  }, [queryClient])

  const boards = boardsData?.boards ?? []

  const boardSelectorOptions = boards.map((b) => ({
    value: b.id,
    label: b.name
  }))

  useEffect(() => {
    if (!debugEnabled) return
    const debugState = {
      selectedBoardId,
      createModalOpen,
      createPending: createBoardMutation.isPending,
      boardsCount: boards.length,
      boardLoaded: boardData ? boardData.id : null
    }
    ;(window as any).__kanbanUiDebug = debugState
    debugLog("state", debugState)
  }, [
    debugEnabled,
    selectedBoardId,
    createModalOpen,
    createBoardMutation.isPending,
    boards.length,
    boardData?.id,
    debugLog
  ])

  const renderHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Kanban className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-semibold">Kanban Playground</h1>
      </div>
      <div className="flex items-center gap-2">
        <Select
          placeholder="Select a board"
          style={{ width: 200 }}
          value={selectedBoardId}
          onChange={setSelectedBoardId}
          options={boardSelectorOptions}
          loading={boardsLoading}
          allowClear
          onClear={() => setSelectedBoardId(null)}
        />
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateModalOpen(true)}
        >
          New Board
        </Button>
        <Button
          icon={<RefreshCw className="w-4 h-4" />}
          onClick={() => {
            refetchBoards()
            if (selectedBoardId) refetchBoard()
          }}
        />
      </div>
    </div>
  )

  const tabItems = [
    {
      key: "board",
      label: (
        <span className="flex items-center gap-2">
          <Kanban className="w-4 h-4" />
          Board
        </span>
      ),
      children: (
        <div className="min-h-[500px]">
          {boardLoading ? (
            <div className="flex items-center justify-center h-96">
              <Spin size="large" />
            </div>
          ) : !selectedBoardId ? (
            <Empty
              description="Select a board or create a new one"
              className="mt-20"
            >
              <Button
                type="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setCreateModalOpen(true)}
              >
                Create Board
              </Button>
            </Empty>
          ) : boardData ? (
            <BoardView
              board={boardData}
              onRefresh={() => refetchBoard()}
              onDelete={handleDeleteBoard}
            />
          ) : null}
        </div>
      )
    },
    {
      key: "import",
      label: (
        <span className="flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Import
        </span>
      ),
      children: <ImportPanel onImported={handleBoardImported} />
    }
  ]

  return (
    <div className="kanban-playground">
      {renderHeader()}

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as PlaygroundTab)}
        items={tabItems}
      />

      {/* Create Board Modal */}
      <Modal
        title="Create New Board"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          setNewBoardName("")
        }}
        onOk={handleCreateBoard}
        okText="Create"
        confirmLoading={createBoardMutation.isPending}
      >
        <div className="py-4">
          <label className="block text-sm font-medium mb-2">Board Name</label>
          <Input
            placeholder="Enter board name"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            onPressEnter={handleCreateBoard}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  )
}

export default KanbanPlayground

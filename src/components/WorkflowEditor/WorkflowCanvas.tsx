/**
 * WorkflowCanvas Component
 *
 * The main React Flow canvas for the workflow editor.
 * Handles node rendering, connections, and canvas interactions.
 */

import { useCallback, useRef, useMemo, useEffect } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
  BackgroundVariant,
  SelectionMode,
  type Node
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import type { WorkflowStepType, WorkflowNode, WorkflowNodeData } from "@/types/workflow-editor"
import { useWorkflowEditorStore } from "@/store/workflow-editor"
import { workflowNodeTypes } from "./nodes/WorkflowNode"
import { getStepMetadata } from "./step-registry"

interface WorkflowCanvasProps {
  className?: string
}

const WorkflowCanvasInner = ({ className = "" }: WorkflowCanvasProps) => {
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  // Store state
  const nodes = useWorkflowEditorStore((s) => s.nodes)
  const edges = useWorkflowEditorStore((s) => s.edges)
  const isMiniMapVisible = useWorkflowEditorStore((s) => s.isMiniMapVisible)
  const isGridVisible = useWorkflowEditorStore((s) => s.isGridVisible)

  // Store actions
  const onNodesChange = useWorkflowEditorStore((s) => s.onNodesChange)
  const onEdgesChange = useWorkflowEditorStore((s) => s.onEdgesChange)
  const onConnect = useWorkflowEditorStore((s) => s.onConnect)
  const addNode = useWorkflowEditorStore((s) => s.addNode)
  const setSelectedNodes = useWorkflowEditorStore((s) => s.setSelectedNodes)
  const setSelectedEdges = useWorkflowEditorStore((s) => s.setSelectedEdges)
  const setZoom = useWorkflowEditorStore((s) => s.setZoom)
  const setPanPosition = useWorkflowEditorStore((s) => s.setPanPosition)

  // Handle selection changes
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes, edges }) => {
      setSelectedNodes(nodes.map((n) => n.id))
      setSelectedEdges(edges.map((e) => e.id))
    },
    [setSelectedNodes, setSelectedEdges]
  )

  // Handle drop from node palette
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const stepType = event.dataTransfer.getData(
        "application/workflow-step"
      ) as WorkflowStepType

      if (!stepType) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })

      addNode({ type: stepType, position })
    },
    [screenToFlowPosition, addNode]
  )

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected nodes/edges
      if (e.key === "Delete" || e.key === "Backspace") {
        const selectedNodes = useWorkflowEditorStore.getState().selectedNodeIds
        const selectedEdges = useWorkflowEditorStore.getState().selectedEdgeIds

        if (selectedNodes.length > 0) {
          useWorkflowEditorStore.getState().deleteNodes(selectedNodes)
        }
        if (selectedEdges.length > 0) {
          useWorkflowEditorStore.getState().deleteEdges(selectedEdges)
        }
      }

      // Undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        useWorkflowEditorStore.getState().undo()
      }

      // Redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault()
        useWorkflowEditorStore.getState().redo()
      }

      // Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault()
        const selectedNodes = useWorkflowEditorStore.getState().selectedNodeIds
        if (selectedNodes.length > 0) {
          useWorkflowEditorStore.getState().duplicateNodes(selectedNodes)
        }
      }

      // Select all
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault()
        const nodes = useWorkflowEditorStore.getState().nodes
        setSelectedNodes(nodes.map((n) => n.id))
      }

      // Escape to deselect
      if (e.key === "Escape") {
        useWorkflowEditorStore.getState().deselectAll()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [setSelectedNodes])

  // Handle viewport changes
  const handleMoveEnd = useCallback(
    (event: any, viewport: { x: number; y: number; zoom: number }) => {
      setZoom(viewport.zoom)
      setPanPosition({ x: viewport.x, y: viewport.y })
    },
    [setZoom, setPanPosition]
  )

  // Node colors for minimap
  const nodeColor = useCallback((node: Node) => {
    const data = node.data as WorkflowNodeData
    const meta = getStepMetadata(data.stepType)
    const categoryColors: Record<string, string> = {
      ai: "#a855f7",
      data: "#3b82f6",
      control: "#f97316",
      io: "#22c55e",
      utility: "#6b7280"
    }
    return categoryColors[meta?.category || "utility"] || "#6b7280"
  }, [])

  return (
    <div className={`h-full w-full ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange<WorkflowNode>}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        onConnect={onConnect as OnConnect}
        onSelectionChange={handleSelectionChange}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMoveEnd={handleMoveEnd}
        onInit={(instance) => {
          reactFlowInstance.current = instance
        }}
        nodeTypes={workflowNodeTypes}
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag={false}
        panOnScroll
        zoomOnScroll
        panOnDrag
        fitView
        fitViewOptions={{
          padding: 0.2,
          maxZoom: 1.5
        }}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
          style: {
            strokeWidth: 2,
            stroke: "#94a3b8"
          }
        }}
        connectionLineStyle={{
          strokeWidth: 2,
          stroke: "#3b82f6"
        }}
        proOptions={{
          hideAttribution: true
        }}
        className="bg-gray-50 dark:bg-gray-900"
      >
        {isGridVisible && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="#94a3b8"
            className="opacity-30"
          />
        )}

        <Controls
          showZoom
          showFitView
          showInteractive={false}
          className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !shadow-lg"
        />

        {isMiniMapVisible && (
          <MiniMap
            nodeColor={nodeColor}
            maskColor="rgba(0, 0, 0, 0.1)"
            className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
          />
        )}
      </ReactFlow>
    </div>
  )
}

// Wrap with ReactFlowProvider
export const WorkflowCanvas = (props: WorkflowCanvasProps) => (
  <ReactFlowProvider>
    <WorkflowCanvasInner {...props} />
  </ReactFlowProvider>
)

export default WorkflowCanvas

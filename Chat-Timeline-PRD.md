# Chat Timeline & Branch Navigation PRD

## Executive Summary

This PRD outlines the implementation of a conversation timeline/tree visualization feature for the tldw browser extension. Inspired by SillyTavern-Timelines, this feature will enable users to visualize their chat histories as a directed acyclic graph (DAG), navigate between conversation branches, edit messages at any point, and create new branches from existing conversations.

## Background & Motivation

### Problem Statement

Currently, tldw stores chat histories as linear sequences of messages. While the extension supports branching via `generateBranchMessage()`, users have no visual way to:
- See the relationship between branched conversations
- Navigate between different conversation timelines
- Understand the full context of how conversations evolved
- Edit or regenerate messages at arbitrary points in history
- Jump to specific points in conversation history

### Reference Implementation: SillyTavern-Timelines

SillyTavern-Timelines provides an excellent reference for this feature:

**Core Concepts:**
- Uses **Cytoscape.js** with **Dagre** layout for DAG visualization
- Messages with identical content at the same depth are merged into single nodes
- Supports "swipes" (alternative responses) as separate nodes with visual indicators
- Provides real-time fulltext search with "swoop" (fragment-based AND search)
- Checkpoints/bookmarks for named branches
- Context menus and tooltips for navigation actions

**Key User Interactions:**
- **Hover** on node: Shows message preview + connected edge highlights
- **Click** on node: Opens full info panel with navigation options
- **Double-click** on node: Quick-navigate to that message
- **Long-press** on node: Toggle swipe nodes visibility
- **Click** on edge: Navigate to the far endpoint
- **Click** on legend item: Highlight and zoom to related elements

## Goals & Non-Goals

### Goals

1. **Visualize Conversation Branches**: Display all chat histories as an interactive graph showing relationships between conversations
2. **Enable Non-Linear Navigation**: Allow users to jump to any point in any conversation branch
3. **Support Message Editing**: Edit messages at any point, automatically creating branches when needed
4. **Enable Response Regeneration**: Regenerate AI responses at any point, creating alternative branches
5. **Provide Intuitive Search**: Implement fulltext search with visual highlighting across all conversations
6. **Maintain Performance**: Handle large conversation histories (1000+ messages) smoothly

### Non-Goals (Phase 1)

- Real-time collaboration or syncing timeline views
- Merging divergent branches back together
- Automatic summarization of branches
- Export timeline visualizations as images
- Mobile-first design (desktop-first for Phase 1)

## Technical Architecture

### Data Model Changes

#### New Database Schema Additions

```typescript
// New types in src/db/dexie/types.ts

export type MessageBranch = {
  id: string;
  parent_message_id: string | null;  // null for root messages
  history_id: string;
  branch_name?: string;  // optional user-defined name
  created_from_edit: boolean;
  createdAt: number;
};

export type MessageSwipe = {
  id: string;
  message_id: string;
  content: string;
  selected: boolean;  // is this the currently displayed version
  createdAt: number;
  generationInfo?: any;
};

// Updated Message type
export type Message = {
  id: string;
  history_id: string;
  parent_id: string | null;  // NEW: enables tree structure
  name: string;
  role: string;
  content: string;
  images?: string[];
  sources?: string[];
  search?: WebSearch;
  createdAt: number;
  reasoning_time_taken?: number;
  messageType?: string;
  generationInfo?: any;
  modelName?: string;
  modelImage?: string;
  documents?: ChatDocuments;
  swipes?: string[];  // NEW: array of MessageSwipe IDs
  active_swipe_index?: number;  // NEW: index of currently selected swipe
  depth?: number;  // NEW: computed depth in conversation tree
};
```

#### New Database Tables

```typescript
// In src/db/dexie/schema.ts
this.version(2).stores({
  // ... existing stores ...
  messageBranches: 'id, parent_message_id, history_id, branch_name, createdAt',
  messageSwipes: 'id, message_id, selected, createdAt'
});
```

### Graph Data Structure

```typescript
// src/services/timeline/graph-builder.ts

export type TimelineNode = {
  id: string;
  type: 'root' | 'message' | 'swipe';
  depth: number;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  history_ids: string[];  // which chat histories contain this node
  message_id: string;
  swipe_index?: number;
  is_checkpoint: boolean;
  checkpoint_name?: string;
  has_swipes: boolean;
  swipe_count: number;
};

export type TimelineEdge = {
  id: string;
  source: string;  // node ID
  target: string;  // node ID
  history_ids: string[];  // which histories this edge belongs to
  is_swipe_edge: boolean;
  checkpoint_color?: string;
};

export type TimelineGraph = {
  nodes: TimelineNode[];
  edges: TimelineEdge[];
};
```

### Core Services

#### 1. Graph Builder Service

```typescript
// src/services/timeline/graph-builder.ts

export class TimelineGraphBuilder {
  /**
   * Build a timeline graph from multiple chat histories
   * Merges identical messages at the same depth into single nodes
   */
  async buildGraph(historyIds: string[]): Promise<TimelineGraph>;

  /**
   * Add swipe nodes for a specific message
   */
  expandSwipes(nodeId: string): Promise<TimelineNode[]>;

  /**
   * Compute node depth in the conversation tree
   */
  private computeDepth(messageId: string): number;

  /**
   * Group messages by content at each depth level
   */
  private groupMessagesByContentAtDepth(
    messages: Message[],
    depth: number
  ): Map<string, Message[]>;
}
```

#### 2. Timeline Navigation Service

```typescript
// src/services/timeline/navigation.ts

export class TimelineNavigationService {
  /**
   * Navigate to a specific message in a chat history
   */
  async navigateToMessage(
    historyId: string,
    messageId: string,
    swipeIndex?: number
  ): Promise<void>;

  /**
   * Create a new branch from a specific message
   */
  async createBranch(
    historyId: string,
    messageId: string,
    branchName?: string
  ): Promise<string>;  // returns new history ID

  /**
   * Edit a message, creating a branch if it's not the last message
   */
  async editMessage(
    historyId: string,
    messageId: string,
    newContent: string
  ): Promise<{ historyId: string; messageId: string }>;

  /**
   * Regenerate an AI response, adding as a swipe
   */
  async regenerateResponse(
    historyId: string,
    messageId: string
  ): Promise<string>;  // returns new swipe ID
}
```

#### 3. Search Service

```typescript
// src/services/timeline/search.ts

export type SearchMode = 'fragments' | 'substring';

export class TimelineSearchService {
  /**
   * Search across all messages with swoop-style fragment search
   */
  async search(
    query: string,
    mode: SearchMode = 'fragments'
  ): Promise<TimelineNode[]>;

  /**
   * Parse query into fragments for highlighting
   */
  parseQueryFragments(query: string): string[];

  /**
   * Highlight matching fragments in text
   */
  highlightMatches(text: string, fragments: string[]): string;
}
```

### UI Components

#### 1. Timeline View Modal

```typescript
// src/components/Timeline/TimelineModal.tsx

interface TimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHistoryId?: string;  // focus on specific history
}

export const TimelineModal: React.FC<TimelineModalProps>;
```

**Features:**
- Full-screen modal with graph canvas
- Toolbar: rotate, expand swipes, reload, zoom controls
- Search bar with real-time filtering
- Legend showing node types and checkpoint paths
- Responsive layout (LR for landscape, TB for portrait)

#### 2. Graph Canvas Component

```typescript
// src/components/Timeline/GraphCanvas.tsx

interface GraphCanvasProps {
  graph: TimelineGraph;
  onNodeClick: (node: TimelineNode) => void;
  onNodeDoubleClick: (node: TimelineNode) => void;
  onNodeHold: (node: TimelineNode) => void;
  onEdgeClick: (edge: TimelineEdge) => void;
  highlightedNodes?: string[];
  selectedNode?: string;
}

export const GraphCanvas: React.FC<GraphCanvasProps>;
```

**Implementation Options:**
1. **Cytoscape.js** (recommended): Same library as SillyTavern-Timelines, mature DAG support
2. **React Flow**: React-native, good DX, but less mature for large graphs
3. **D3.js**: Maximum flexibility, higher implementation cost

**Recommendation**: Use Cytoscape.js for consistency with reference implementation and proven performance with DAGs.

#### 3. Node Info Panel

```typescript
// src/components/Timeline/NodeInfoPanel.tsx

interface NodeInfoPanelProps {
  node: TimelineNode;
  onNavigate: (historyId: string, messageId: string) => void;
  onBranch: (historyId: string, messageId: string) => void;
  onEdit: (historyId: string, messageId: string) => void;
  onRegenerate: (historyId: string, messageId: string) => void;
  onClose: () => void;
}

export const NodeInfoPanel: React.FC<NodeInfoPanelProps>;
```

**Features:**
- Full message content display
- Sender name and timestamp
- List of chat histories containing this message
- Action buttons: Go to, Branch, Edit, Regenerate
- Navigation arrows (previous/next in timeline)

#### 4. Timeline Settings

```typescript
// src/components/Timeline/TimelineSettings.tsx

interface TimelineSettings {
  // Layout
  nodeWidth: number;
  nodeHeight: number;
  nodeSeparation: number;
  rankSeparation: number;

  // Appearance
  nodeShape: 'ellipse' | 'rectangle' | 'roundrectangle';
  curveStyle: 'taxi' | 'bezier' | 'straight';
  userNodeColor: string;
  assistantNodeColor: string;
  systemNodeColor: string;
  edgeColor: string;

  // Behavior
  autoExpandSwipes: boolean;
  showLegend: boolean;
  zoomLevel: number;
  minZoom: number;
  maxZoom: number;
}
```

### State Management

```typescript
// src/store/timeline.tsx

interface TimelineState {
  // View state
  isOpen: boolean;
  currentHistoryId: string | null;

  // Graph state
  graph: TimelineGraph | null;
  expandedSwipeNodes: Set<string>;

  // Selection/highlight state
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
  searchQuery: string;

  // Settings
  settings: TimelineSettings;

  // Actions
  openTimeline: (historyId?: string) => void;
  closeTimeline: () => void;
  loadGraph: (historyIds: string[]) => Promise<void>;
  toggleSwipes: (nodeId: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setSearchQuery: (query: string) => void;
  updateSettings: (settings: Partial<TimelineSettings>) => void;
}

export const useTimelineStore = create<TimelineState>(...);
```

## User Experience

### Entry Points

1. **Chat History List**: "View Timeline" button/icon on each chat history card
2. **Active Chat**: Timeline icon in chat header toolbar
3. **Keyboard Shortcut**: `Ctrl+Shift+T` (configurable)
4. **Command**: `/timeline` slash command

### Core User Flows

#### Flow 1: Exploring Conversation History

1. User opens Timeline view from chat history
2. Graph loads centered on current chat's latest message
3. User hovers over nodes to preview content
4. User clicks on a node to see full info panel
5. User navigates to different branch by clicking "Go to" button

#### Flow 2: Creating a Branch from History

1. User opens Timeline view
2. User finds desired branch point (message)
3. User clicks node to open info panel
4. User clicks "Branch from here" button
5. New chat history is created, user is navigated there
6. Graph updates to show new branch

#### Flow 3: Editing a Historical Message

1. User opens Timeline view
2. User finds message to edit
3. User clicks "Edit" in node info panel
4. Edit modal opens with message content
5. User makes changes and saves
6. If not last message: new branch is created with edited message
7. Graph updates to show the edit branch

#### Flow 4: Regenerating a Response

1. User opens Timeline view
2. User finds AI response to regenerate
3. User clicks "Regenerate" in node info panel
4. New response is generated and added as a swipe
5. Node gains swipe indicator
6. User can toggle swipes to see alternatives

#### Flow 5: Searching Across Conversations

1. User opens Timeline view
2. User types in search bar
3. Graph highlights matching nodes in real-time
4. View auto-zooms to fit highlighted nodes
5. User clicks on highlighted node to navigate

### Visual Design

#### Node Styles

| Node Type | Shape | Color | Indicator |
|-----------|-------|-------|-----------|
| User Message | Ellipse | Blue (configurable) | None |
| Assistant Message | Ellipse | White (configurable) | None |
| System Message | Rectangle | Gray | None |
| Swipe Node | Ellipse | Same as parent | Halo ring |
| Checkpoint | Ellipse | Same as type | Colored ring |

#### Edge Styles

- Default: Gray curved line (taxi or bezier)
- Checkpoint path: Colored line matching checkpoint
- Swipe edge: Dashed line

#### Interactions

- **Hover**: Tooltip with truncated message + highlight connected edges
- **Click**: Open info panel
- **Double-click**: Quick navigate to message
- **Long-press (500ms)**: Toggle swipe expansion for that node
- **Drag canvas**: Pan view
- **Scroll/pinch**: Zoom in/out

## Implementation Plan

### Phase 1: Foundation (Core Functionality)

**Duration**: 2-3 weeks

1. **Database Schema Updates**
   - Add `parent_id` to messages
   - Create `messageBranches` and `messageSwipes` tables
   - Write migration for existing data

2. **Graph Builder Service**
   - Implement `TimelineGraphBuilder`
   - Message deduplication by content+depth
   - Depth computation algorithm

3. **Basic UI**
   - `TimelineModal` component
   - `GraphCanvas` with Cytoscape.js
   - Basic node rendering and navigation

4. **Navigation Service**
   - `navigateToMessage` implementation
   - Integration with existing chat view

### Phase 2: Branching & Editing

**Duration**: 2-3 weeks

1. **Branch Creation**
   - `createBranch` implementation
   - UI flow for branching

2. **Message Editing**
   - `editMessage` with auto-branching
   - Edit modal component

3. **Swipe Support**
   - Swipe node rendering
   - Toggle swipe visibility
   - Swipe selection

### Phase 3: Search & Polish

**Duration**: 1-2 weeks

1. **Search Implementation**
   - Fragment search (swoop)
   - Real-time highlighting
   - Zoom to results

2. **Settings & Customization**
   - Timeline settings panel
   - Theming integration
   - Keyboard shortcuts

3. **Performance Optimization**
   - Virtual rendering for large graphs
   - Lazy loading of message content
   - Caching graph data

### Phase 4: Advanced Features (Future)

- Checkpoint naming and management
- Timeline export (JSON, image)
- Comparison view for branches
- AI-powered branch summarization

## Dependencies

### New NPM Packages

```json
{
  "cytoscape": "^3.28.0",
  "cytoscape-dagre": "^2.5.0",
  "cytoscape-popper": "^2.0.0",
  "@tippyjs/react": "^4.2.6"
}
```

### Bundle Size Considerations

- Cytoscape.js: ~360KB minified
- Dagre: ~320KB minified
- Consider lazy loading timeline components

## Success Metrics

1. **Adoption**: % of users who use timeline view at least once per week
2. **Engagement**: Average time spent in timeline view
3. **Branch Creation**: Number of branches created per user
4. **Search Usage**: Number of searches performed
5. **Performance**: Time to render graph with 100, 500, 1000 nodes

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance with large histories | High | Virtual rendering, pagination, lazy loading |
| Complex migration for existing data | Medium | Backward-compatible schema, phased rollout |
| Cytoscape learning curve | Medium | Start with reference implementation patterns |
| Mobile usability | Medium | Desktop-first, mobile as Phase 2 |

## Confirmed Design Decisions

1. **Timeline Scope**: Per-character - Show conversation tree for a single character/assistant (matches SillyTavern approach)

2. **Swipes Support**: Full swipes - Multiple alternative responses stored per message, users can toggle between them. Implemented via `parent_message_id` - messages with the same parent form a "swipe group".

3. **Offline Support**: Server-first - Require server connection for forking, leverages existing tldw_server API and ensures sync

4. **Server Schema**: The tldw_server2 ChaChaDB **already supports branching** via:
   - `conversations.root_id` - All forks share same root_id
   - `conversations.parent_conversation_id` - Parent in fork tree
   - `conversations.forked_from_message_id` - Message that spawned fork
   - `messages.parent_message_id` - Enables message threading/swipes

## Appendix

### A. SillyTavern-Timelines Code Structure

```
SillyTavern-Timelines/
├── index.js          # Main entry, event handlers, UI setup
├── tl_graph.js       # Graph orientation, search highlighting
├── tl_node_data.js   # Node/edge data structures, graph building
├── tl_style.js       # Cytoscape styling rules
├── tl_utils.js       # Navigation, modal handling
├── timeline.html     # Settings panel HTML
└── [various .css]    # Styling
```

### B. Key Algorithms from Reference

**Message Grouping by Content at Depth:**
```javascript
function groupMessagesByContent(messages) {
  let groups = {};
  messages.forEach((messageObj) => {
    let { message } = messageObj;
    if (!groups[message.mes]) {
      groups[message.mes] = [];
    }
    groups[message.mes].push(messageObj);
  });
  return groups;
}
```

**Fragment Search (Swoop):**
```javascript
function makeQueryFragments(query, doLowerCase) {
  let fragments = query.trim().split(/\s+/).map(str => str.trim());
  fragments = [...new Set(fragments)];  // unique only
  if (doLowerCase) {
    fragments = fragments.map(str => str.toLowerCase());
  }
  return fragments;
}

// Match: all fragments must be present (AND logic)
const matches = all(
  fragment => msgLowerCase.includes(fragment),
  fragments
);
```

### C. Cytoscape Configuration Reference

```javascript
const cy = cytoscape({
  container: document.getElementById('graph'),
  elements: nodeData,
  style: styles,
  layout: {
    name: 'dagre',
    nodeDimensionsIncludeLabels: true,
    nodeSep: 50,
    edgeSep: 10,
    rankSep: 50,
    rankDir: 'TB',  // or 'LR'
    ranker: 'tight-tree',
    align: 'UL',
  },
  wheelSensitivity: 0.2,
});
```

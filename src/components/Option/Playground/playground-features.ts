/**
 * Playground Enhanced Features
 *
 * This file exports all the new playground features for easy integration:
 *
 * 1. Parameter Presets - Quick settings for Creative/Balanced/Precise modes
 * 2. Cost Estimation - Token-based cost calculation and display
 * 3. JSON Mode Toggle - Structured output control
 * 4. System Prompt Templates - Pre-built prompt library
 * 5. Conversation Branching - Fork conversations from any message
 * 6. Enhanced Toolbar - Combined toolbar component
 */

// Parameter Presets
export {
  ParameterPresets,
  ParameterPresetsDropdown,
  PRESETS,
  type PresetKey,
  type ParameterPreset
} from "./ParameterPresets"

// Cost Estimation
export {
  CostEstimation,
  SessionCostEstimation
} from "./CostEstimation"

// JSON Mode
export {
  JsonModeToggle,
  JsonModeIndicator
} from "./JsonModeToggle"

// System Prompt Templates
export {
  SystemPromptTemplatesModal,
  SystemPromptTemplatesButton,
  PROMPT_TEMPLATES,
  CATEGORY_INFO,
  type PromptTemplate,
  type PromptCategory
} from "./SystemPromptTemplates"

// Conversation Branching
export {
  ConversationBranching,
  QuickBranchButton,
  BranchIndicator
} from "./ConversationBranching"

// Enhanced Toolbar (combines all features)
export {
  PlaygroundEnhancedToolbar,
  PlaygroundQuickSettings
} from "./PlaygroundEnhancedToolbar"

// Model Pricing Utils
export {
  getModelPricing,
  estimateCost,
  formatCost,
  getPriceTier,
  type ModelPricing
} from "@/utils/model-pricing"

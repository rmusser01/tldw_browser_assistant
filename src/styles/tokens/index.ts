/**
 * Design System Tokens
 *
 * Centralized design tokens for consistent UI across the extension.
 * Import from this module for all design system values.
 *
 * @example
 * ```tsx
 * import { spacing, fontSize, statusColors } from "@/styles/tokens"
 *
 * <div className={spacing.md}>
 *   <p className={fontSize.body}>Content</p>
 * </div>
 * ```
 */

// Spacing
export {
  spacing,
  padding,
  paddingX,
  paddingY,
  margin,
  type SpacingSize,
} from "./spacing"

// Typography
export {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  type FontSize,
  type FontWeight,
} from "./typography"

// Colors
export {
  bgColor,
  textColor,
  borderColor,
  statusColors,
  temporaryChatIndicator,
  type StatusType,
} from "./colors"

// Motion
export {
  duration,
  easing,
  transition,
  motionSafe,
  type Duration,
  type Easing,
} from "./motion"

// Layout
export {
  zIndex,
  container,
  sidebarWidth,
  touchTarget,
  type ZIndex,
  type Container,
} from "./layout"

// Borders
export {
  borderRadius,
  borderWidth,
  borderStyle,
  type BorderRadius,
  type BorderWidth,
} from "./borders"

// Shadows
export { shadow, innerShadow, type Shadow } from "./shadows"

// Focus
export { focusRing, withFocusRing, type FocusRing } from "./focus"

// Components
export {
  buttonBase,
  buttonSize,
  iconButton,
  iconSize,
  badge,
  inputBase,
  cardBase,
  type ButtonSize,
  type IconSize,
  type BadgeVariant,
} from "./components"

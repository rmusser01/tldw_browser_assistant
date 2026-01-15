import React, { Suspense, lazy } from "react"
import type { CommandPaletteProps } from "@/components/Common/CommandPalette"

const CommandPalette = lazy(() =>
  import("@/components/Common/CommandPalette").then((m) => ({
    default: m.CommandPalette
  }))
)

const KeyboardShortcutsModal = lazy(() =>
  import("@/components/Common/KeyboardShortcutsModal").then((m) => ({
    default: m.KeyboardShortcutsModal
  }))
)

type EventOnlyHostsProps = {
  commandPaletteProps?: CommandPaletteProps
}

export const EventOnlyHosts = ({
  commandPaletteProps
}: EventOnlyHostsProps) => (
  <>
    <Suspense fallback={null}>
      <CommandPalette {...commandPaletteProps} />
    </Suspense>
    <Suspense fallback={null}>
      <KeyboardShortcutsModal />
    </Suspense>
  </>
)

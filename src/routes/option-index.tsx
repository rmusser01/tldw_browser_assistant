import React from "react"

import {
  useConnectionActions,
  useConnectionState,
  useConnectionUxState
} from "@/hooks/useConnectionState"
import { ConnectionPhase } from "@/types/connection"
import { useFocusComposerOnConnect } from "@/hooks/useComposerFocus"
import { OnboardingWizard } from "@/components/Option/Onboarding/OnboardingWizard"
import OptionLayout from "~/components/Layouts/Layout"
import { Playground } from "~/components/Option/Playground/Playground"

const OptionIndex = () => {
  const { phase } = useConnectionState()
  const { uxState, hasCompletedFirstRun } = useConnectionUxState()
  const { checkOnce, beginOnboarding, markFirstRunComplete } = useConnectionActions()
  const onboardingInitiated = React.useRef(false)

  React.useEffect(() => {
    if (hasCompletedFirstRun) {
      void checkOnce()
    }
  }, [checkOnce, hasCompletedFirstRun])

  React.useEffect(() => {
    if (!hasCompletedFirstRun && !onboardingInitiated.current) {
      onboardingInitiated.current = true
      void beginOnboarding()
    }
  }, [hasCompletedFirstRun, beginOnboarding])

  useFocusComposerOnConnect(phase ?? null)

  // During first-time setup, hide the connection shell entirely and show only
  // the onboarding wizard (“Welcome — Let’s get you connected”).
  if (!hasCompletedFirstRun) {
    return (
      <OptionLayout hideHeader showHeaderSelectors={false}>
        <OnboardingWizard
          onFinish={async () => {
            try {
              await checkOnce()
            } finally {
              try {
                await markFirstRunComplete()
              } catch {
                // ignore markFirstRunComplete failures here; connection state will self-heal on next load
              }
            }
          }}
        />
      </OptionLayout>
    )
  }

  return (
    <OptionLayout
      showHeaderSelectors={false}
    >
      <Playground />
    </OptionLayout>
  )
}

export default OptionIndex

import type { ReactNode } from "react"

type EventHostOptions<State> = {
  useEvents: () => State
  isActive?: (state: State) => boolean
  render: (state: State) => ReactNode
}

export const createEventHost = <State,>({
  useEvents,
  isActive,
  render
}: EventHostOptions<State>) => {
  const EventHost = () => {
    const state = useEvents()
    if (isActive && !isActive(state)) {
      return null
    }
    return render(state)
  }

  return EventHost
}

import type { State } from "@/store/option/types"

export type StoreSlice<T> = (
  set: (
    partial: Partial<State> | ((state: State) => Partial<State>)
  ) => void,
  get: () => State
) => T

import { Form } from "antd"
import { useEffect, useState } from "react"

/**
 * Hook to debounce form field value for preview rendering.
 * Useful for avoiding expensive re-renders on every keystroke.
 */
export function useDebouncedFormField(form: any, name: string, delay = 300): string {
  const value = Form.useWatch(name, form)
  const [debounced, setDebounced] = useState<string>(value ?? "")

  useEffect(() => {
    const nextValue = value ?? ""
    const timer = window.setTimeout(() => {
      setDebounced(nextValue)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

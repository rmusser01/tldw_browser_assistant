/**
 * Utility for conditionally joining classNames together.
 * A simplified clsx/classnames alternative.
 */
export function cn(
  ...classes: (string | false | null | undefined | 0 | Record<string, boolean>)[]
): string {
  return classes
    .flatMap((c) => {
      if (!c) return []
      if (typeof c === "string") return [c]
      if (typeof c === "object") {
        return Object.entries(c)
          .filter(([, v]) => v)
          .map(([k]) => k)
      }
      return []
    })
    .join(" ")
}

export default cn

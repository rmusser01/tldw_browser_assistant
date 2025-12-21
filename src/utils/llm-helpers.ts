export function extractGenerationInfo(
  output: unknown
): Record<string, unknown> | undefined {
  try {
    if (typeof output !== "object" || output === null) return undefined
    if (!("generations" in output)) return undefined

    const generations = (output as { generations?: unknown }).generations
    if (!Array.isArray(generations) || generations.length === 0) return undefined

    const firstBatch = generations[0]
    if (!Array.isArray(firstBatch) || firstBatch.length === 0) return undefined

    const firstGeneration = firstBatch[0]
    if (typeof firstGeneration !== "object" || firstGeneration === null) {
      return undefined
    }
    if (!("generationInfo" in firstGeneration)) return undefined

    return (firstGeneration as { generationInfo?: Record<string, unknown> })
      .generationInfo
  } catch (e) {
    console.error("extractGenerationInfo error", e)
    return undefined
  }
}

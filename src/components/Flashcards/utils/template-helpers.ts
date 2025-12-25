import type { Flashcard } from "@/services/flashcards"

type FlashcardModelType = Flashcard["model_type"]

export const normalizeFlashcardTemplateFields = <
  T extends {
    model_type?: FlashcardModelType | null
    reverse?: boolean | null
    is_cloze?: boolean | null
  }
>(
  values: T
): T => {
  const isCloze = values.model_type === "cloze" || values.is_cloze === true
  const isReverse = values.model_type === "basic_reverse" || values.reverse === true
  const model_type: FlashcardModelType = isCloze
    ? "cloze"
    : isReverse
      ? "basic_reverse"
      : "basic"

  return {
    ...values,
    model_type,
    reverse: model_type === "basic_reverse",
    is_cloze: model_type === "cloze"
  }
}

import type { TFunction } from "i18next"
import type { Flashcard } from "@/services/flashcards"

type ModelType = Flashcard["model_type"]

/**
 * Maps technical model_type values to user-friendly labels.
 */
export function getModelTypeLabel(
  modelType: ModelType,
  t: TFunction
): string {
  switch (modelType) {
    case "basic":
      return t("option:flashcards.modelTypeBasic", { defaultValue: "Standard" })
    case "basic_reverse":
      return t("option:flashcards.modelTypeBasicReverse", { defaultValue: "Reversible" })
    case "cloze":
      return t("option:flashcards.modelTypeCloze", { defaultValue: "Fill-in-blank" })
    default:
      return modelType
  }
}

/**
 * Formats the card type display including reverse indicator.
 */
export function formatCardType(
  card: Pick<Flashcard, "model_type" | "reverse">,
  t: TFunction
): string {
  const label = getModelTypeLabel(card.model_type, t)
  if (card.reverse && card.model_type !== "basic_reverse") {
    return `${label} - ${t("option:flashcards.reverseCard", { defaultValue: "reverse" })}`
  }
  return label
}

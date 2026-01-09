import FeatureEmptyState from "@/components/Common/FeatureEmptyState"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

type WorkspaceLinkProps = {
  titleKey: string
  titleDefault: string
  descriptionKey: string
  descriptionDefault: string
  actionKey: string
  actionDefault: string
  to: string
}

const WorkspaceLink = ({
  titleKey,
  titleDefault,
  descriptionKey,
  descriptionDefault,
  actionKey,
  actionDefault,
  to
}: WorkspaceLinkProps) => {
  const { t } = useTranslation(["settings", "option"])
  const navigate = useNavigate()

  return (
    <FeatureEmptyState
      title={t(titleKey, { defaultValue: titleDefault })}
      description={t(descriptionKey, { defaultValue: descriptionDefault })}
      primaryActionLabel={t(actionKey, { defaultValue: actionDefault })}
      onPrimaryAction={() => navigate(to)}
    />
  )
}

export const PromptWorkspaceSettings = () => (
  <WorkspaceLink
    titleKey="settings:managePrompts.workspaceTitle"
    titleDefault="Prompts workspace"
    descriptionKey="settings:managePrompts.workspaceDescription"
    descriptionDefault="Reusable prompts are managed from the Prompts workspace. Use the button below to open it."
    actionKey="settings:managePrompts.openWorkspace"
    actionDefault="Open Prompts workspace"
    to="/prompts"
  />
)

export const WorldBooksWorkspaceSettings = () => (
  <WorkspaceLink
    titleKey="settings:manageKnowledge.worldBooksSettingsTitle"
    titleDefault="World Books workspace"
    descriptionKey="settings:manageKnowledge.worldBooksSettingsDescription"
    descriptionDefault="World Books are managed from the World Books workspace. Use the button below to open it."
    actionKey="settings:manageKnowledge.worldBooksOpenWorkspace"
    actionDefault="Open World Books workspace"
    to="/world-books"
  />
)

export const DictionariesWorkspaceSettings = () => (
  <WorkspaceLink
    titleKey="settings:manageKnowledge.dictionariesSettingsTitle"
    titleDefault="Chat dictionaries workspace"
    descriptionKey="settings:manageKnowledge.dictionariesSettingsDescription"
    descriptionDefault="Chat dictionaries are managed from the Chat dictionaries workspace. Use the button below to open it."
    actionKey="settings:manageKnowledge.dictionariesOpenWorkspace"
    actionDefault="Open Chat dictionaries workspace"
    to="/dictionaries"
  />
)

export const CharactersWorkspaceSettings = () => (
  <WorkspaceLink
    titleKey="settings:charactersSettingsTitle"
    titleDefault="Characters workspace"
    descriptionKey="settings:charactersSettingsDescription"
    descriptionDefault="Characters are managed from the Characters workspace. Use the button below to open it."
    actionKey="settings:charactersOpenWorkspace"
    actionDefault="Open Characters workspace"
    to="/characters"
  />
)

import React from "react"
import { Tabs } from "antd"
import { useTranslation } from "react-i18next"
import { TakeQuizTab, GenerateTab, CreateTab, ManageTab, ResultsTab } from "./tabs"

/**
 * QuizPlayground contains all the tabs and core quiz logic.
 * Connection state is handled by QuizWorkspace.
 */
export const QuizPlayground: React.FC = () => {
  const { t } = useTranslation(["option", "common"])
  const [activeTab, setActiveTab] = React.useState<string>("take")
  const [startQuizId, setStartQuizId] = React.useState<number | null>(null)

  return (
    <div className="mx-auto max-w-6xl p-4">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "take",
            label: t("option:quiz.take", { defaultValue: "Take Quiz" }),
            children: (
              <TakeQuizTab
                startQuizId={startQuizId}
                onStartHandled={() => setStartQuizId(null)}
                onNavigateToGenerate={() => setActiveTab("generate")}
                onNavigateToCreate={() => setActiveTab("create")}
              />
            )
          },
          {
            key: "generate",
            label: t("option:quiz.generate", { defaultValue: "Generate" }),
            children: (
              <GenerateTab
                onNavigateToTake={() => setActiveTab("take")}
              />
            )
          },
          {
            key: "create",
            label: t("option:quiz.create", { defaultValue: "Create" }),
            children: (
              <CreateTab
                onNavigateToTake={() => setActiveTab("take")}
              />
            )
          },
          {
            key: "manage",
            label: t("option:quiz.manage", { defaultValue: "Manage" }),
            children: (
              <ManageTab
                onNavigateToCreate={() => setActiveTab("create")}
                onNavigateToGenerate={() => setActiveTab("generate")}
                onStartQuiz={(quizId) => {
                  setStartQuizId(quizId)
                  setActiveTab("take")
                }}
              />
            )
          },
          {
            key: "results",
            label: t("option:quiz.results", { defaultValue: "Results" }),
            children: <ResultsTab />
          }
        ]}
      />
    </div>
  )
}

export default QuizPlayground

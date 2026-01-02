import React from "react"
import { Button, Card, Checkbox, Form, InputNumber, Progress, Select, Spin, Alert, message } from "antd"
import { useTranslation } from "react-i18next"
import { RocketOutlined } from "@ant-design/icons"
import { useQuery } from "@tanstack/react-query"
import { bgRequest } from "@/services/background-proxy"
import { useGenerateQuizMutation } from "../hooks"
import type { QuestionType } from "@/services/quizzes"

interface GenerateTabProps {
  onNavigateToTake: () => void
}

interface MediaItem {
  id: number
  title: string
  type: string
}

interface MediaListResponse {
  items: MediaItem[]
  pagination?: {
    total_items: number
  }
}

const QUESTION_TYPE_OPTIONS: { label: string; value: QuestionType }[] = [
  { label: "Multiple Choice", value: "multiple_choice" },
  { label: "True/False", value: "true_false" },
  { label: "Fill in the Blank", value: "fill_blank" }
]

const DIFFICULTY_OPTIONS = [
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
  { label: "Mixed", value: "mixed" }
]

export const GenerateTab: React.FC<GenerateTabProps> = ({ onNavigateToTake }) => {
  const { t } = useTranslation(["option", "common", "settings"])
  const [form] = Form.useForm()
  const [selectedMediaId, setSelectedMediaId] = React.useState<number | null>(null)
  const [messageApi, contextHolder] = message.useMessage()

  const generateMutation = useGenerateQuizMutation()

  // Fetch media list
  const {
    data: mediaList,
    isLoading: isLoadingList,
    error: listError
  } = useQuery<MediaListResponse>({
    queryKey: ["media-list-for-quiz"],
    queryFn: async () => {
      return await bgRequest<MediaListResponse>({
        path: "/api/v1/media?page=1&results_per_page=100",
        method: "GET"
      })
    },
    staleTime: 60 * 1000
  })

  const mediaOptions = React.useMemo(() => {
    if (!mediaList?.items) return []
    return mediaList.items.map((item) => ({
      value: item.id,
      label: `${item.title || `Media #${item.id}`} (${item.type})`
    }))
  }, [mediaList])

  const handleGenerate = async () => {
    if (!selectedMediaId) {
      messageApi.warning(
        t("option:quiz.selectMediaFirst", { defaultValue: "Please select a media item first" })
      )
      return
    }

    try {
      const values = await form.validateFields()
      await generateMutation.mutateAsync({
        media_id: selectedMediaId,
        num_questions: values.numQuestions,
        question_types: values.questionTypes,
        difficulty: values.difficulty
      })
      messageApi.success(
        t("option:quiz.generateSuccess", { defaultValue: "Quiz generated successfully!" })
      )
      onNavigateToTake()
    } catch (error) {
      messageApi.error(
        t("option:quiz.generateError", { defaultValue: "Failed to generate quiz" })
      )
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {contextHolder}

      <Card
        title={t("option:quiz.selectMedia", { defaultValue: "Select Media" })}
        size="small"
      >
        {listError ? (
          <Alert
            type="error"
            message={t("settings:chunkingPlayground.loadMediaListError", "Failed to load media library")}
          />
        ) : (
          <div className="space-y-2">
            <Select
              showSearch
              placeholder={t("option:quiz.selectMediaPlaceholder", { defaultValue: "Select media item..." })}
              loading={isLoadingList}
              value={selectedMediaId}
              onChange={(value) => setSelectedMediaId(value)}
              options={mediaOptions}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
              className="w-full"
              notFoundContent={
                isLoadingList ? <Spin size="small" /> : t("option:quiz.noMediaFound", { defaultValue: "No media found" })
              }
            />
            {mediaList?.pagination && (
              <div className="text-xs text-text-subtle">
                {t("option:quiz.mediaCount", {
                  defaultValue: "{{count}} media items available",
                  count: mediaList.pagination.total_items
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card
        title={t("option:quiz.quizSettings", { defaultValue: "Quiz Settings" })}
        size="small"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            numQuestions: 10,
            questionTypes: ["multiple_choice", "true_false"],
            difficulty: "mixed"
          }}
        >
          <Form.Item
            name="numQuestions"
            label={t("option:quiz.numQuestions", { defaultValue: "Number of Questions" })}
          >
            <InputNumber min={5} max={50} className="w-full" />
          </Form.Item>

          <Form.Item
            name="questionTypes"
            label={t("option:quiz.questionTypes", { defaultValue: "Question Types" })}
          >
            <Checkbox.Group options={QUESTION_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="difficulty"
            label={t("option:quiz.difficulty", { defaultValue: "Difficulty" })}
          >
            <Select options={DIFFICULTY_OPTIONS} />
          </Form.Item>
        </Form>
      </Card>

      {generateMutation.isPending && (
        <Card size="small">
          <div className="text-center space-y-4">
            <Spin size="large" />
            <p className="text-text-muted">
              {t("option:quiz.generating", { defaultValue: "Generating quiz..." })}
            </p>
            <Progress percent={50} status="active" showInfo={false} />
          </div>
        </Card>
      )}

      <Button
        type="primary"
        icon={<RocketOutlined />}
        size="large"
        onClick={handleGenerate}
        loading={generateMutation.isPending}
        disabled={!selectedMediaId}
        block
      >
        {t("option:quiz.generateQuiz", { defaultValue: "Generate Quiz" })}
      </Button>
    </div>
  )
}

export default GenerateTab

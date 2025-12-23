import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listQuizzes,
  createQuiz,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  startAttempt,
  submitAttempt,
  listAttempts,
  getAttempt,
  generateQuiz,
  type Quiz,
  type Question,
  type QuestionListParams,
  type QuizCreate,
  type QuizUpdate,
  type QuestionCreate,
  type QuestionUpdate,
  type QuizGenerateRequest,
  type QuizAnswer,
  type QuizListParams,
  type AttemptListParams
} from "@/services/quizzes"
import { useServerOnline } from "@/hooks/useServerOnline"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"

export interface UseQuizQueriesOptions {
  enabled?: boolean
}

/**
 * Helper to check if quizzes feature is available
 */
export function useQuizzesEnabled() {
  const isOnline = useServerOnline()
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const quizzesUnsupported = !capsLoading && !!capabilities && !capabilities.hasQuizzes

  return {
    isOnline,
    capsLoading,
    quizzesUnsupported,
    quizzesEnabled: isOnline && !quizzesUnsupported
  }
}

// --- Quiz Queries ---

/**
 * Hook for fetching quiz list
 */
export function useQuizzesQuery(params: QuizListParams = {}, options?: UseQuizQueriesOptions) {
  const { quizzesEnabled } = useQuizzesEnabled()

  return useQuery({
    queryKey: ["quizzes:list", params],
    queryFn: () => listQuizzes(params),
    enabled: options?.enabled ?? quizzesEnabled
  })
}

/**
 * Hook for fetching a single quiz with its questions
 */
export function useQuizQuery(quizId: number | null | undefined, options?: UseQuizQueriesOptions) {
  const { quizzesEnabled } = useQuizzesEnabled()

  return useQuery({
    queryKey: ["quizzes:detail", quizId],
    queryFn: () => getQuiz(quizId!),
    enabled: (options?.enabled ?? quizzesEnabled) && quizId != null
  })
}

/**
 * Hook for fetching questions for a quiz
 */
export function useQuestionsQuery(
  quizId: number | null | undefined,
  params: QuestionListParams = {},
  options?: UseQuizQueriesOptions
) {
  const { quizzesEnabled } = useQuizzesEnabled()

  return useQuery({
    queryKey: ["quizzes:questions", quizId, params],
    queryFn: () => listQuestions(quizId!, params),
    enabled: (options?.enabled ?? quizzesEnabled) && quizId != null
  })
}

// --- Quiz Mutations ---

/**
 * Hook for creating a quiz
 */
export function useCreateQuizMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["quizzes:create"],
    mutationFn: (payload: QuizCreate) => createQuiz(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes:list"] })
    }
  })
}

/**
 * Hook for updating a quiz
 */
export function useUpdateQuizMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["quizzes:update"],
    mutationFn: (params: { quizId: number; update: QuizUpdate }) =>
      updateQuiz(params.quizId, params.update),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["quizzes:list"] })
      qc.invalidateQueries({ queryKey: ["quizzes:detail", variables.quizId] })
    }
  })
}

/**
 * Hook for deleting a quiz
 */
export function useDeleteQuizMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["quizzes:delete"],
    mutationFn: (params: { quizId: number; version: number }) =>
      deleteQuiz(params.quizId, params.version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes:list"] })
    }
  })
}

// --- Question Mutations ---

/**
 * Hook for creating a question
 */
export function useCreateQuestionMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["quizzes:question:create"],
    mutationFn: (params: { quizId: number; question: QuestionCreate }) =>
      createQuestion(params.quizId, params.question),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["quizzes:questions", variables.quizId] })
      qc.invalidateQueries({ queryKey: ["quizzes:detail", variables.quizId] })
    }
  })
}

/**
 * Hook for updating a question
 */
export function useUpdateQuestionMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["quizzes:question:update"],
    mutationFn: (params: { quizId: number; questionId: number; update: QuestionUpdate }) =>
      updateQuestion(params.quizId, params.questionId, params.update),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["quizzes:questions", variables.quizId] })
    }
  })
}

/**
 * Hook for deleting a question
 */
export function useDeleteQuestionMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["quizzes:question:delete"],
    mutationFn: (params: { quizId: number; questionId: number; version: number }) =>
      deleteQuestion(params.quizId, params.questionId, params.version),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["quizzes:questions", variables.quizId] })
      qc.invalidateQueries({ queryKey: ["quizzes:detail", variables.quizId] })
    }
  })
}

// --- Attempt Queries & Mutations ---

/**
 * Hook for fetching attempt list
 */
export function useAttemptsQuery(params: AttemptListParams = {}, options?: UseQuizQueriesOptions) {
  const { quizzesEnabled } = useQuizzesEnabled()

  return useQuery({
    queryKey: ["quizzes:attempts", params],
    queryFn: () => listAttempts(params),
    enabled: options?.enabled ?? quizzesEnabled
  })
}

/**
 * Hook for fetching a single attempt
 */
export function useAttemptQuery(attemptId: number | null | undefined, options?: UseQuizQueriesOptions) {
  const { quizzesEnabled } = useQuizzesEnabled()

  return useQuery({
    queryKey: ["quizzes:attempt", attemptId],
    queryFn: () => getAttempt(attemptId!),
    enabled: (options?.enabled ?? quizzesEnabled) && attemptId != null
  })
}

/**
 * Hook for starting a quiz attempt
 */
export function useStartAttemptMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["quizzes:attempt:start"],
    mutationFn: (quizId: number) => startAttempt(quizId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes:attempts"] })
    }
  })
}

/**
 * Hook for submitting a quiz attempt
 */
export function useSubmitAttemptMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["quizzes:attempt:submit"],
    mutationFn: (params: { attemptId: number; answers: Omit<QuizAnswer, "is_correct">[] }) =>
      submitAttempt(params.attemptId, params.answers),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes:attempts"] })
    }
  })
}

// --- AI Generation ---

/**
 * Hook for generating a quiz from media
 */
export function useGenerateQuizMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationKey: ["quizzes:generate"],
    mutationFn: (request: QuizGenerateRequest) => generateQuiz(request),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes:list"] })
    }
  })
}

// Re-export types
export type {
  Quiz,
  Question,
  QuizCreate,
  QuizUpdate,
  QuestionCreate,
  QuestionUpdate,
  QuizGenerateRequest
}

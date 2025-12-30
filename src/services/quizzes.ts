import { bgRequest } from "@/services/background-proxy"
import type { AllowedPath } from "@/services/tldw/openapi-guard"

// Question types
export type QuestionType = "multiple_choice" | "true_false" | "fill_blank"
export type AnswerValue = number | string

// Quiz container
export type Quiz = {
  id: number
  name: string
  description?: string | null
  media_id?: number | null
  total_questions: number
  time_limit_seconds?: number | null
  passing_score?: number | null
  deleted: boolean
  client_id: string
  version: number
  created_at?: string | null
  last_modified?: string | null
}

// Individual question
export type QuestionBase = {
  id: number
  quiz_id: number
  question_type: QuestionType
  question_text: string
  options?: string[] | null
  points: number
  order_index: number
  tags?: string[] | null
  deleted: boolean
  client_id: string
  version: number
  created_at?: string | null
  last_modified?: string | null
}

export type QuestionPublic = QuestionBase

export type QuestionAdmin = QuestionBase & {
  correct_answer: AnswerValue
  explanation?: string | null
}

export type Question = QuestionAdmin

// Quiz attempt answer
export type QuizAnswer = {
  question_id: number
  user_answer: AnswerValue
  is_correct: boolean
  correct_answer?: AnswerValue
  explanation?: string | null
  points_awarded?: number | null
  time_spent_ms?: number | null
}

// Quiz attempt/session
export type QuizAttempt = {
  id: number
  quiz_id: number
  started_at: string
  completed_at?: string | null
  score?: number | null
  total_possible: number
  time_spent_seconds?: number | null
  answers: QuizAnswer[]
  questions?: QuestionPublic[]
}

// Create types
export type QuizCreate = {
  name: string
  description?: string | null
  media_id?: number | null
  time_limit_seconds?: number | null
  passing_score?: number | null
}

export type QuizUpdate = {
  name?: string | null
  description?: string | null
  media_id?: number | null
  time_limit_seconds?: number | null
  passing_score?: number | null
  expected_version?: number | null
}

export type QuestionCreate = {
  question_type: QuestionType
  question_text: string
  options?: string[] | null
  correct_answer: AnswerValue
  explanation?: string | null
  points?: number
  order_index?: number
  tags?: string[] | null
}

export type QuestionUpdate = {
  question_type?: QuestionType | null
  question_text?: string | null
  options?: string[] | null
  correct_answer?: AnswerValue | null
  explanation?: string | null
  points?: number | null
  order_index?: number | null
  tags?: string[] | null
  expected_version?: number | null
}

// AI generation request
export type QuizGenerateRequest = {
  media_id: number
  num_questions?: number
  question_types?: QuestionType[]
  difficulty?: "easy" | "medium" | "hard" | "mixed"
  focus_topics?: string[]
  model?: string
}

// List response types
export type QuizListResponse = {
  items: Quiz[]
  count: number
}

export type QuestionListResponse = {
  items: Array<QuestionPublic | QuestionAdmin>
  count: number
}

export type AttemptListResponse = {
  items: QuizAttempt[]
  count: number
}

// List params
export type QuizListParams = {
  media_id?: number | null
  q?: string | null
  limit?: number
  offset?: number
}

export type QuestionListParams = {
  include_answers?: boolean
  q?: string | null
  limit?: number
  offset?: number
}

export type AttemptListParams = {
  quiz_id?: number | null
  limit?: number
  offset?: number
}

export type QuizGenerateResponse = {
  quiz: Quiz
  questions: QuestionAdmin[]
}

// --- Quizzes CRUD ---

export async function listQuizzes(params: QuizListParams = {}): Promise<QuizListResponse> {
  const search = new URLSearchParams()
  if (params.media_id != null) search.set("media_id", String(params.media_id))
  if (params.q) search.set("q", params.q)
  if (typeof params.limit === "number") search.set("limit", String(params.limit))
  if (typeof params.offset === "number") search.set("offset", String(params.offset))
  const qs = search.toString()
  const path = `/api/v1/quizzes${qs ? `?${qs}` : ""}` as AllowedPath
  return await bgRequest<QuizListResponse, AllowedPath, "GET">({ path, method: "GET" })
}

export async function createQuiz(input: QuizCreate): Promise<Quiz> {
  return await bgRequest<Quiz, AllowedPath, "POST">({
    path: "/api/v1/quizzes",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: input
  })
}

export async function getQuiz(quizId: number): Promise<Quiz> {
  return await bgRequest<Quiz, AllowedPath, "GET">({
    path: `/api/v1/quizzes/${quizId}` as AllowedPath,
    method: "GET"
  })
}

export async function updateQuiz(quizId: number, input: QuizUpdate): Promise<void> {
  await bgRequest<void, AllowedPath, "PATCH">({
    path: `/api/v1/quizzes/${quizId}` as AllowedPath,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: input
  })
}

export async function deleteQuiz(quizId: number, expectedVersion: number): Promise<void> {
  await bgRequest<void, AllowedPath, "DELETE">({
    path: `/api/v1/quizzes/${quizId}?expected_version=${expectedVersion}` as AllowedPath,
    method: "DELETE"
  })
}

// --- Questions CRUD ---

export async function listQuestions(
  quizId: number,
  params: QuestionListParams = {}
): Promise<QuestionListResponse> {
  const search = new URLSearchParams()
  if (params.include_answers) search.set("include_answers", "true")
  if (params.q) search.set("q", params.q)
  if (typeof params.limit === "number") search.set("limit", String(params.limit))
  if (typeof params.offset === "number") search.set("offset", String(params.offset))
  const qs = search.toString()
  const path = `/api/v1/quizzes/${quizId}/questions${qs ? `?${qs}` : ""}` as AllowedPath
  return await bgRequest<QuestionListResponse, AllowedPath, "GET">({
    path,
    method: "GET"
  })
}

export async function createQuestion(quizId: number, input: QuestionCreate): Promise<Question> {
  return await bgRequest<Question, AllowedPath, "POST">({
    path: `/api/v1/quizzes/${quizId}/questions` as AllowedPath,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: input
  })
}

export async function updateQuestion(
  quizId: number,
  questionId: number,
  input: QuestionUpdate
): Promise<void> {
  await bgRequest<void, AllowedPath, "PATCH">({
    path: `/api/v1/quizzes/${quizId}/questions/${questionId}` as AllowedPath,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: input
  })
}

export async function deleteQuestion(
  quizId: number,
  questionId: number,
  expectedVersion: number
): Promise<void> {
  await bgRequest<void, AllowedPath, "DELETE">({
    path: `/api/v1/quizzes/${quizId}/questions/${questionId}?expected_version=${expectedVersion}` as AllowedPath,
    method: "DELETE"
  })
}

// --- Quiz Attempts ---

export async function startAttempt(quizId: number): Promise<QuizAttempt> {
  return await bgRequest<QuizAttempt, AllowedPath, "POST">({
    path: `/api/v1/quizzes/${quizId}/attempts` as AllowedPath,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {}
  })
}

export async function submitAttempt(
  attemptId: number,
  answers: Omit<QuizAnswer, "is_correct">[]
): Promise<QuizAttempt> {
  return await bgRequest<QuizAttempt, AllowedPath, "PUT">({
    path: `/api/v1/quizzes/attempts/${attemptId}` as AllowedPath,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: { answers }
  })
}

export async function listAttempts(params: AttemptListParams = {}): Promise<AttemptListResponse> {
  const search = new URLSearchParams()
  if (params.quiz_id != null) search.set("quiz_id", String(params.quiz_id))
  if (typeof params.limit === "number") search.set("limit", String(params.limit))
  if (typeof params.offset === "number") search.set("offset", String(params.offset))
  const qs = search.toString()
  const path = `/api/v1/quizzes/attempts${qs ? `?${qs}` : ""}` as AllowedPath
  return await bgRequest<AttemptListResponse, AllowedPath, "GET">({ path, method: "GET" })
}

export async function getAttempt(attemptId: number): Promise<QuizAttempt> {
  return await bgRequest<QuizAttempt, AllowedPath, "GET">({
    path: `/api/v1/quizzes/attempts/${attemptId}` as AllowedPath,
    method: "GET"
  })
}

// --- AI Generation ---

export async function generateQuiz(request: QuizGenerateRequest): Promise<QuizGenerateResponse> {
  return await bgRequest<QuizGenerateResponse, AllowedPath, "POST">({
    path: "/api/v1/quizzes/generate",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: request
  })
}

# Quiz Playground Implementation Plan

## Overview

Add a new **Quiz Playground** feature with both frontend (browser extension) and backend (tldw_server2) implementations.

**Key Decisions:**
- Storage: Server-side (tldw_server API)
- Question Types: Multiple Choice, True/False, Fill-in-the-Blank
- Creation: AI-generated from media + Manual creation
- Integration: Standalone page (like ChunkingPlayground)

**Status:**
- [x] Frontend (Extension) - Phase 1 Foundation complete
- [ ] Backend (tldw_server2) - To be implemented

---

# PART 1: FRONTEND (Browser Extension)

> **Status: Phase 1 Complete** - Basic UI scaffolding done, ready for backend

---

## Data Model

```typescript
// Quiz container
type Quiz = {
  id: number
  name: string
  description?: string
  media_id?: number              // Source media for AI-generated
  total_questions: number
  time_limit_seconds?: number    // Optional timed quiz
  passing_score?: number         // e.g., 70 for 70%
  created_at: string
}

// Question types
type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank'

type Question = {
  id: number
  quiz_id: number
  question_type: QuestionType
  question_text: string
  options?: string[]             // For multiple_choice
  correct_answer: number | string // MC uses 0-based index number; TF uses "true"/"false"; fill uses text
  explanation?: string           // Shown after answering
  points: number
  order_index: number
}

type QuestionPublic = Omit<Question, "correct_answer" | "explanation"> // Returned when include_answers=false

// Quiz attempt
type QuizAttempt = {
  id: number
  quiz_id: number
  started_at: string
  completed_at?: string
  score?: number
  total_possible: number
  answers: { question_id: number; user_answer: number | string; is_correct: boolean }[]
  questions?: QuestionPublic[]   // Snapshot for the attempt
  // Server stores a question snapshot at start for stable grading if questions change
}
```

---

## API Endpoints (tldw_server)

```
# Quizzes CRUD
GET    /api/v1/quizzes                # limit, offset, q, media_id
POST   /api/v1/quizzes
GET    /api/v1/quizzes/{id}
PATCH  /api/v1/quizzes/{id}
DELETE /api/v1/quizzes/{id}

# Questions
GET    /api/v1/quizzes/{id}/questions        # include_answers=false by default, limit, offset, q
POST   /api/v1/quizzes/{id}/questions
PATCH  /api/v1/quizzes/{id}/questions/{q_id}
DELETE /api/v1/quizzes/{id}/questions/{q_id}

# Attempts
POST   /api/v1/quizzes/{id}/attempts        # Start attempt
PUT    /api/v1/quizzes/attempts/{id}        # Submit answers
GET    /api/v1/quizzes/attempts             # List user attempts (limit, offset, quiz_id)

# AI Generation
POST   /api/v1/quizzes/generate             # Generate from media
```

---

## File Structure

```
src/components/Quiz/
  QuizWorkspace.tsx              # Connection/capability handling
  QuizPlayground.tsx             # Tab container (Manager)

  tabs/
    TakeQuizTab.tsx              # Quiz-taking experience
    GenerateTab.tsx              # AI generation from media
    CreateTab.tsx                # Manual quiz creation
    ManageTab.tsx                # Browse/edit/delete quizzes
    ResultsTab.tsx               # View attempt history

  components/
    QuestionCard.tsx             # Renders question during quiz
    QuestionEditor.tsx           # Form for creating/editing
    QuizProgress.tsx             # Progress bar
    QuizTimer.tsx                # Countdown timer
    ResultsSummary.tsx           # Post-quiz results
    AnswerInput.tsx              # Dynamic input by question type

  hooks/
    useQuizQueries.ts            # React Query hooks
    useQuizAttempt.ts            # Attempt state management
    useQuizTimer.ts              # Timer logic
```

---

## Implementation Phases

### Phase 1: Foundation
1. Add `hasQuizzes` to `ServerCapabilities` in `src/services/tldw/server-capabilities.ts`
2. Create `src/services/quizzes.ts` with types and API functions
3. Create `src/components/Quiz/hooks/useQuizQueries.ts`
4. Create `QuizWorkspace.tsx` (connection handling shell)
5. Create `QuizPlayground.tsx` with empty tab structure
6. Add route in `src/routes/option-quiz.tsx`
7. Register route in `src/routes/chrome.tsx`
8. Add navigation entry in `src/components/Layouts/settings-nav.ts`

### Phase 2: AI Generation (GenerateTab)
1. Reuse `MediaSelector` component from ChunkingPlayground
2. Build generation options form (question count, types, difficulty)
3. Wire up `POST /api/v1/quizzes/generate` mutation
4. Show generation progress and preview

### Phase 3: Manual Creation (CreateTab)
1. Quiz metadata form (name, description, time limit, passing score)
2. `QuestionEditor` component with type switching
3. Multiple Choice editor (options + correct answer)
4. True/False editor (toggle)
5. Fill-in-the-blank editor (text with `___` markers)
6. Question list with reordering

### Phase 4: Quiz Taking (TakeQuizTab)
1. Quiz selection list with cards
2. `QuestionCard` for rendering questions during quiz
3. `useQuizAttempt` hook for state management
4. Navigation (Previous/Next, question dots)
5. `QuizTimer` component (optional)
6. Submit and transition to results

### Phase 5: Results & Management
1. `ResultsSummary` with score circle, breakdown by type
2. Per-question review with correct/incorrect indicators
3. `ManageTab` with quiz list, edit, delete
4. `ResultsTab` with attempt history

### Phase 6: Polish
1. Add i18n keys to `src/assets/locale/*/option.json`
2. Add demo mode content (optional)
3. E2E tests in `tests/e2e/quiz.spec.ts`

---

## Critical Files to Modify/Create

**New Files:**
- `src/routes/option-quiz.tsx`
- `src/services/quizzes.ts`
- `src/components/Quiz/**/*`

**Modify:**
- `src/routes/chrome.tsx` - Add lazy import and route
- `src/components/Layouts/settings-nav.ts` - Add nav item
- `src/services/tldw/server-capabilities.ts` - Add `hasQuizzes`
- `src/assets/locale/en/option.json` - Add i18n keys

**Reference (patterns to follow):**
- `src/components/Flashcards/FlashcardsWorkspace.tsx` - Connection handling
- `src/components/Flashcards/FlashcardsManager.tsx` - Tab structure
- `src/components/Flashcards/hooks/useFlashcardQueries.ts` - React Query hooks
- `src/components/Option/ChunkingPlayground/MediaSelector.tsx` - Media selection
- `src/services/flashcards.ts` - Service layer pattern

---

## Tab Structure

| Tab | Purpose | Key Components |
|-----|---------|----------------|
| Take Quiz | Select and take quizzes | QuizCard, QuestionCard, QuizProgress, QuizTimer |
| Generate | AI-generate from media | MediaSelector, generation options form |
| Create | Manual quiz creation | QuestionEditor, type-specific forms |
| Manage | CRUD operations | List, filters, bulk actions |
| Results | Historical attempts | ResultsSummary, attempt list, analytics |

---

## Navigation Entry

```typescript
// In settings-nav.ts, workspace group:
{ to: "/quiz", icon: ClipboardList, labelToken: "option:header.quiz", beta: true }
```

---

## Notes

- Quiz generation requires corresponding tldw_server API endpoints
- Timer is optional per-quiz (controlled by `time_limit_seconds`)
- Follow existing patterns from Flashcards for consistency
- Use React Query for all server state management
- Maintain `quizzes.total_questions` on question create/delete (or recompute on bulk updates)
- Snapshot questions at attempt start and grade against the snapshot to prevent drift after edits

---

# PART 2: BACKEND (tldw_server2)

> **Status: Not Started** - Full API implementation needed

## Server Architecture Context

**Framework**: FastAPI with Pydantic v2
**Database**: Per-user SQLite (ChaChaNotes.db) with PostgreSQL support
**Reference**: Flashcards feature implementation

---

## Files to Create

### 1. Pydantic Schemas
**File**: `tldw_Server_API/app/api/v1/schemas/quizzes.py`

```python
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from enum import Enum

class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    FILL_BLANK = "fill_blank"

class QuizCreate(BaseModel):
    name: str
    description: Optional[str] = None
    media_id: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    passing_score: Optional[int] = None

class QuizUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = None
    description: Optional[str] = None
    media_id: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    passing_score: Optional[int] = None

class QuizResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    media_id: Optional[int]
    total_questions: int
    time_limit_seconds: Optional[int]
    passing_score: Optional[int]
    deleted: bool
    client_id: str
    version: int
    created_at: Optional[str]
    last_modified: Optional[str]

class QuestionCreate(BaseModel):
    question_type: QuestionType
    question_text: str
    options: Optional[List[str]] = None  # For multiple choice
    correct_answer: int | str  # MC: 0-based index number; TF/fill: string
    explanation: Optional[str] = None
    points: int = 1
    order_index: int = 0
    tags: Optional[List[str]] = None

class QuestionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question_type: Optional[QuestionType] = None
    question_text: Optional[str] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[int | str] = None
    explanation: Optional[str] = None
    points: Optional[int] = None
    order_index: Optional[int] = None
    tags: Optional[List[str]] = None

class QuestionPublicResponse(BaseModel):
    id: int
    quiz_id: int
    question_type: QuestionType
    question_text: str
    options: Optional[List[str]]
    points: int
    order_index: int
    tags: Optional[List[str]]
    deleted: bool
    client_id: str
    version: int
    created_at: Optional[str]
    last_modified: Optional[str]

class QuestionAdminResponse(QuestionPublicResponse):
    correct_answer: int | str
    explanation: Optional[str]

class QuizAnswerInput(BaseModel):
    question_id: int
    user_answer: int | str
    time_spent_ms: Optional[int] = None

class AttemptSubmitRequest(BaseModel):
    answers: List[QuizAnswerInput]

class AttemptResponse(BaseModel):
    id: int
    quiz_id: int
    started_at: str
    completed_at: Optional[str]
    score: Optional[int]
    total_possible: int
    time_spent_seconds: Optional[int]
    answers: List[dict]  # Detailed answer breakdown (includes grading on submit)
    questions: Optional[List[QuestionPublicResponse]] = None  # Provided on start_attempt

class QuizGenerateRequest(BaseModel):
    media_id: int
    num_questions: int = 10
    question_types: Optional[List[QuestionType]] = None
    difficulty: str = "mixed"  # easy, medium, hard, mixed
    focus_topics: Optional[List[str]] = None
    model: Optional[str] = None
```

### 2. Database Tables (SQLite + PostgreSQL)

The server uses a backend abstraction pattern - queries are written in SQLite syntax and automatically transformed for PostgreSQL. Follow the pattern from flashcards.

**SQLite Schema** (add to ChaChaNotes_DB.py `_init_schema_v6()` or similar):

```sql
-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    media_id INTEGER,
    total_questions INTEGER DEFAULT 0,
    time_limit_seconds INTEGER,
    passing_score INTEGER,
    deleted BOOLEAN NOT NULL DEFAULT 0,
    client_id TEXT NOT NULL DEFAULT 'unknown',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quizzes_media_id ON quizzes(media_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_deleted ON quizzes(deleted);

-- Questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL CHECK(question_type IN ('multiple_choice', 'true_false', 'fill_blank')),
    question_text TEXT NOT NULL,
    options TEXT,  -- JSON array for multiple choice
    correct_answer TEXT NOT NULL,  -- MC uses 0-based index (stored as string/integer)
    explanation TEXT,
    points INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    tags_json TEXT,  -- JSON array
    deleted BOOLEAN NOT NULL DEFAULT 0,
    client_id TEXT NOT NULL DEFAULT 'unknown',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_deleted ON quiz_questions(deleted);

-- FTS for question search (SQLite)
CREATE VIRTUAL TABLE IF NOT EXISTS quiz_questions_fts
USING fts5(
    question_text, explanation,
    content='quiz_questions',
    content_rowid='id'
);

-- FTS Triggers (SQLite)
CREATE TRIGGER quiz_questions_ai AFTER INSERT ON quiz_questions BEGIN
    INSERT INTO quiz_questions_fts(rowid, question_text, explanation)
    SELECT new.id, new.question_text, new.explanation
    WHERE new.deleted = 0;
END;

CREATE TRIGGER quiz_questions_ad AFTER DELETE ON quiz_questions BEGIN
    INSERT INTO quiz_questions_fts(quiz_questions_fts, rowid, question_text, explanation)
    VALUES('delete', old.id, old.question_text, old.explanation);
END;

CREATE TRIGGER quiz_questions_au AFTER UPDATE ON quiz_questions BEGIN
    INSERT INTO quiz_questions_fts(quiz_questions_fts, rowid, question_text, explanation)
    VALUES('delete', old.id, old.question_text, old.explanation);
    INSERT INTO quiz_questions_fts(rowid, question_text, explanation)
    SELECT new.id, new.question_text, new.explanation
    WHERE new.deleted = 0;
END;

-- Attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    score INTEGER,
    total_possible INTEGER NOT NULL,
    time_spent_seconds INTEGER,
    questions_snapshot TEXT,  -- JSON array of question snapshots (no correct answers exposed to client)
    answers TEXT,  -- JSON array of answer objects
    client_id TEXT NOT NULL DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed_at ON quiz_attempts(completed_at);
```

**PostgreSQL Additions** (add method `_ensure_postgres_quiz_tsvector()`):

```python
def _ensure_postgres_quiz_tsvector(self, conn) -> None:
    """Ensure tsvector column and GIN index for PostgreSQL FTS on questions"""
    if self.backend_type != BackendType.POSTGRESQL:
        return

    # Add tsvector column
    self.backend.execute(
        "ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS quiz_questions_fts_tsv tsvector"
    )

    # Backfill existing rows
    self.backend.execute(
        "UPDATE quiz_questions SET quiz_questions_fts_tsv = to_tsvector('english', "
        "coalesce(question_text,'') || ' ' || coalesce(explanation,''))"
    )

    # Create GIN index
    self.backend.execute(
        "CREATE INDEX IF NOT EXISTS idx_quiz_questions_fts_tsv ON quiz_questions USING GIN (quiz_questions_fts_tsv)"
    )

    # Create trigger for auto-update
    self.backend.execute("""
        CREATE OR REPLACE FUNCTION quiz_questions_fts_update() RETURNS trigger AS $$
        BEGIN
            NEW.quiz_questions_fts_tsv := to_tsvector('english',
                coalesce(NEW.question_text,'') || ' ' || coalesce(NEW.explanation,''));
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS quiz_questions_fts_tsv_update ON quiz_questions;
        CREATE TRIGGER quiz_questions_fts_tsv_update
        BEFORE INSERT OR UPDATE OF question_text, explanation ON quiz_questions
        FOR EACH ROW EXECUTE FUNCTION quiz_questions_fts_update();
    """)
```

**Backend-Specific Query Pattern** (follow flashcards pattern):

```python
# In list_questions() or search methods:
if self.backend_type == BackendType.POSTGRESQL:
    # PostgreSQL: Use tsvector
    where_clauses.append("deleted = FALSE")
    if search_query:
        tsquery = FTSQueryTranslator.normalize_query(search_query, 'postgresql')
        where_clauses.append("quiz_questions_fts_tsv @@ to_tsquery('english', ?)")
        params.append(tsquery)
else:
    # SQLite: Use FTS5
    where_clauses.append("deleted = 0")
    if search_query:
        norm_q = FTSQueryTranslator.normalize_query(search_query, 'sqlite')
        where_clauses.append("id IN (SELECT rowid FROM quiz_questions_fts WHERE quiz_questions_fts MATCH ?)")
        params.append(norm_q)
```

### 3. Database Methods
**Add to**: `tldw_Server_API/app/core/DB_Management/ChaChaNotes_DB.py`

Add methods to `CharactersRAGDB` class:

```python
# Quiz CRUD
def create_quiz(self, name: str, description: Optional[str] = None,
                media_id: Optional[int] = None, time_limit_seconds: Optional[int] = None,
                passing_score: Optional[int] = None, client_id: str = "unknown") -> int:
    """Create a new quiz and return its ID"""

def get_quiz(self, quiz_id: int) -> Optional[Dict]:
    """Get quiz by ID, returns None if not found or deleted"""

def list_quizzes(self, page: int = 1, per_page: int = 20,
                 search: Optional[str] = None, media_id: Optional[int] = None) -> Dict:
    """List quizzes with pagination and optional filters"""

def update_quiz(self, quiz_id: int, updates: Dict, client_id: str = "unknown") -> bool:
    """Update quiz fields, returns True if successful"""

def delete_quiz(self, quiz_id: int, hard_delete: bool = False) -> bool:
    """Soft or hard delete a quiz"""

# Question CRUD
def create_question(self, quiz_id: int, question_type: str, question_text: str,
                    correct_answer: int | str, options: Optional[List[str]] = None,
                    explanation: Optional[str] = None, points: int = 1,
                    order_index: int = 0, tags: Optional[List[str]] = None,
                    client_id: str = "unknown") -> int:
    """Create a question for a quiz and increment total_questions"""

def get_question(self, question_id: int) -> Optional[Dict]:
    """Get question by ID"""

def list_questions(self, quiz_id: int, search: Optional[str] = None,
                   include_answers: bool = False) -> List[Dict]:
    """List all questions for a quiz (omit correct_answer unless include_answers)"""

def update_question(self, question_id: int, updates: Dict, client_id: str = "unknown") -> bool:
    """Update question fields"""

def delete_question(self, question_id: int, hard_delete: bool = False) -> bool:
    """Delete a question and decrement total_questions (or recompute)"""

# Attempts
def start_attempt(self, quiz_id: int, client_id: str = "unknown") -> int:
    """Start a new quiz attempt, snapshot questions, returns attempt ID"""

def submit_attempt(self, attempt_id: int, answers: List[Dict]) -> Dict:
    """Submit answers for an attempt, grade and return results"""

def get_attempt(self, attempt_id: int) -> Optional[Dict]:
    """Get attempt with full answer breakdown"""

def list_attempts(self, quiz_id: Optional[int] = None, page: int = 1, per_page: int = 20) -> Dict:
    """List attempts with optional quiz filter"""

# Grading helper
def _check_answer(self, question: Dict, user_answer: str) -> bool:
    """Grade a single answer based on question type"""
    if question['question_type'] == 'multiple_choice':
        return int(user_answer) == int(question['correct_answer'])
    elif question['question_type'] == 'true_false':
        return user_answer.lower() == question['correct_answer'].lower()
    elif question['question_type'] == 'fill_blank':
        # Case-insensitive, trimmed comparison
        return user_answer.strip().lower() == question['correct_answer'].strip().lower()
    return False
```

### 4. FastAPI Endpoints
**File**: `tldw_Server_API/app/api/v1/endpoints/quizzes.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from ..schemas.quizzes import (
    QuizCreate, QuizUpdate, QuizResponse, QuestionCreate, QuestionUpdate,
    QuestionPublicResponse, QuestionAdminResponse,
    AttemptSubmitRequest, AttemptResponse, QuizGenerateRequest
)
from ....core.DB_Management.ChaChaNotes_DB import CharactersRAGDB
from ....core.DB_Management.Media_DB_v2 import MediaDatabase
from ....dependencies import get_chacha_db, get_media_db

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

# Quiz CRUD
@router.get("", response_model=dict)
async def list_quizzes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    media_id: Optional[int] = None,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """List all quizzes with pagination"""
    return db.list_quizzes(page=page, per_page=per_page, search=search, media_id=media_id)

@router.post("", response_model=QuizResponse)
async def create_quiz(
    quiz: QuizCreate,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """Create a new quiz"""
    quiz_id = db.create_quiz(**quiz.model_dump())
    return db.get_quiz(quiz_id)

@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: int,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """Get a quiz by ID"""
    quiz = db.get_quiz(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz

@router.patch("/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
    quiz_id: int,
    updates: QuizUpdate,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """Update a quiz"""
    if not db.update_quiz(quiz_id, updates.model_dump(exclude_unset=True)):
        raise HTTPException(status_code=404, detail="Quiz not found")
    return db.get_quiz(quiz_id)

@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: int,
    hard: bool = False,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """Delete a quiz"""
    if not db.delete_quiz(quiz_id, hard_delete=hard):
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {"status": "deleted"}

# Question CRUD
@router.get("/{quiz_id}/questions", response_model=List[QuestionPublicResponse | QuestionAdminResponse])
async def list_questions(
    quiz_id: int,
    search: Optional[str] = None,
    include_answers: bool = False,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """List all questions for a quiz (set include_answers=true for Manage/Edit flows)"""
    return db.list_questions(quiz_id, search=search, include_answers=include_answers)

@router.post("/{quiz_id}/questions", response_model=QuestionAdminResponse)
async def create_question(
    quiz_id: int,
    question: QuestionCreate,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """Add a question to a quiz"""
    question_id = db.create_question(quiz_id=quiz_id, **question.model_dump())
    return db.get_question(question_id)

@router.patch("/{quiz_id}/questions/{question_id}", response_model=QuestionAdminResponse)
async def update_question(
    quiz_id: int,
    question_id: int,
    updates: QuestionUpdate,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """Update a question"""
    if not db.update_question(question_id, updates.model_dump(exclude_unset=True)):
        raise HTTPException(status_code=404, detail="Question not found")
    return db.get_question(question_id)

@router.delete("/{quiz_id}/questions/{question_id}")
async def delete_question(
    quiz_id: int,
    question_id: int,
    hard: bool = False,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """Delete a question"""
    if not db.delete_question(question_id, hard_delete=hard):
        raise HTTPException(status_code=404, detail="Question not found")
    return {"status": "deleted"}

# Attempts
@router.post("/{quiz_id}/attempts", response_model=AttemptResponse)
async def start_attempt(
    quiz_id: int,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """Start a new quiz attempt"""
    attempt_id = db.start_attempt(quiz_id)
    return db.get_attempt(attempt_id)

@router.put("/{quiz_id}/attempts/{attempt_id}", response_model=AttemptResponse)
async def submit_attempt(
    quiz_id: int,
    attempt_id: int,
    submission: AttemptSubmitRequest,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """Submit answers for an attempt"""
    attempt = db.get_attempt(attempt_id)
    if not attempt or attempt.quiz_id != quiz_id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    result = db.submit_attempt(attempt_id, [a.model_dump() for a in submission.answers])
    return result

@router.get("/attempts", response_model=dict)
async def list_attempts(
    quiz_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """List quiz attempts"""
    return db.list_attempts(quiz_id=quiz_id, page=page, per_page=per_page)

@router.get("/attempts/{attempt_id}", response_model=AttemptResponse)
async def get_attempt(
    attempt_id: int,
    db: CharactersRAGDB = Depends(get_chacha_db)
):
    """Get attempt details"""
    attempt = db.get_attempt(attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt

# AI Generation
@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(
    request: QuizGenerateRequest,
    db: CharactersRAGDB = Depends(get_chacha_db),
    media_db: MediaDatabase = Depends(get_media_db)
):
    """Generate a quiz from media content using AI"""
    from ....services.quiz_generator import generate_quiz_from_media
    quiz = await generate_quiz_from_media(
        db=db,
        media_db=media_db,
        media_id=request.media_id,
        num_questions=request.num_questions,
        question_types=request.question_types,
        difficulty=request.difficulty,
        focus_topics=request.focus_topics,
        model=request.model
    )
    return quiz
```

### 5. AI Generation Service
**File**: `tldw_Server_API/app/services/quiz_generator.py`

```python
import json
import logging
from typing import List, Optional, Dict
from pydantic import TypeAdapter, ValidationError
from ..core.DB_Management.ChaChaNotes_DB import CharactersRAGDB
from ..core.DB_Management.Media_DB_v2 import MediaDatabase, get_latest_transcription
from ..core.Chat.chat_helpers import extract_response_content
from ..core.Chat.chat_orchestrator import chat_api_call
from ..api.v1.schemas.chat_request_schemas import DEFAULT_LLM_PROVIDER
from ..api.v1.schemas.quizzes import QuestionCreate

logger = logging.getLogger(__name__)

QUIZ_GENERATION_PROMPT = """You are a quiz generator. Based on the following content, generate {num_questions} quiz questions.

Content:
{content}

Requirements:
- Difficulty: {difficulty}
- Question types to include: {question_types}
{focus_instruction}

Return a JSON object in this exact format:
{
  "questions": [
    {
      "question_type": "multiple_choice" | "true_false" | "fill_blank",
      "question_text": "The question text",
      "options": ["A", "B", "C", "D"],  // Only for multiple_choice, exactly 4 options
      "correct_answer": 0 | 1 | 2 | 3 | "true" | "false" | "the answer",
      "explanation": "Brief explanation of why this is correct",
      "points": 1
    }
  ]
}

Important:
- For multiple_choice: options must be array of 4 strings, correct_answer is 0-based index (0-3)
- For true_false: correct_answer must be exactly "true" or "false"
- For fill_blank: question_text should contain ___ where answer goes, correct_answer is the word/phrase
- Vary question difficulty according to the specified level
- Make questions test understanding, not just memorization
- Return ONLY valid JSON, no other text
"""

async def generate_quiz_from_media(
    db: CharactersRAGDB,
    media_db: MediaDatabase,
    media_id: int,
    num_questions: int = 10,
    question_types: Optional[List[str]] = None,
    difficulty: str = "mixed",
    focus_topics: Optional[List[str]] = None,
    model: Optional[str] = None
) -> Dict:
    """
    Generate a quiz from media content using an LLM.

    1. Fetch media content
    2. Build prompt
    3. Call LLM
    4. Parse response
    5. Create quiz + questions in database
    6. Return created quiz
    """
    # 1. Fetch media content (from media database)
    media = media_db.get_media_by_id(media_id, include_deleted=False, include_trash=False)
    if not media:
        raise ValueError(f"Media {media_id} not found")

    content = media.get('content', '') or get_latest_transcription(media_db, media_id) or ''
    if not content:
        raise ValueError(f"Media {media_id} has no content to generate quiz from")

    # Truncate if too long
    if len(content) > 15000:
        content = content[:15000] + "..."

    # 2. Build prompt
    if question_types is None:
        question_types = ["multiple_choice", "true_false", "fill_blank"]

    focus_instruction = ""
    if focus_topics:
        focus_instruction = f"- Focus on these topics: {', '.join(focus_topics)}"

    prompt = QUIZ_GENERATION_PROMPT.format(
        num_questions=num_questions,
        content=content,
        difficulty=difficulty,
        question_types=", ".join(question_types),
        focus_instruction=focus_instruction
    )

    # 3. Call LLM
    response = chat_api_call(
        api_endpoint=DEFAULT_LLM_PROVIDER,
        messages_payload=[{"role": "user", "content": prompt}],
        model=model,
        temp=0.7,
        response_format={"type": "json_object"}  # If supported
    )

    # 4. Parse + validate response
    try:
        content_text = extract_response_content(response) or ""
        raw = json.loads(content_text)
        if isinstance(raw, dict) and 'questions' in raw:
            questions_list = raw['questions']
        elif isinstance(raw, list):
            questions_list = raw
        else:
            raise ValueError("LLM response must be a list or {questions: [...]} object")
        questions_adapter = TypeAdapter(List[QuestionCreate])
        questions_data = [
            q.model_dump()
            for q in questions_adapter.validate_python(questions_list)
        ]
    except (json.JSONDecodeError, ValidationError, ValueError) as e:
        logger.exception("Failed to parse/validate LLM response", exc_info=e)
        raise ValueError(f"Failed to parse/validate LLM response: {e}")

    # 5. Create quiz + questions in database
    quiz_name = f"Quiz: {media.get('title', f'Media #{media_id}')}"
    quiz_id = None
    use_transaction = all(hasattr(db, attr) for attr in ("begin", "commit", "rollback"))
    try:
        if use_transaction:
            db.begin()
        quiz_id = db.create_quiz(
            name=quiz_name,
            description="Auto-generated quiz from media content",
            media_id=media_id
        )

        # Create questions
        for idx, q in enumerate(questions_data):
            db.create_question(
                quiz_id=quiz_id,
                question_type=q['question_type'],
                question_text=q['question_text'],
                correct_answer=q['correct_answer'],
                options=q.get('options'),
                explanation=q.get('explanation'),
                points=q.get('points', 1),
                order_index=idx
            )

        if use_transaction:
            db.commit()
    except Exception as exc:
        if use_transaction:
            db.rollback()
        elif quiz_id is not None:
            db.delete_quiz(quiz_id, hard_delete=True)
        logger.exception("Failed to create quiz and questions", exc_info=exc)
        raise

    # 6. Return created quiz
    return db.get_quiz(quiz_id)
```

---

## Implementation Sequence (Backend)

### Phase 1: Database & Schemas
1. Add SQLite table definitions to schema initialization
2. Add PostgreSQL tsvector setup method
3. Create `schemas/quizzes.py` with all Pydantic models
4. Add database methods to `CharactersRAGDB` class

### Phase 2: CRUD Endpoints
1. Create `endpoints/quizzes.py` with router
2. Implement Quiz CRUD (create, read, update, delete, list)
3. Implement Question CRUD
4. Register router in `main.py`

### Phase 3: Attempts & Grading
1. Implement `start_attempt()` - creates attempt record
2. Implement `submit_attempt()` - grades answers, calculates score
3. Implement `_check_answer()` - per-question-type grading
4. Add time tracking

### Phase 4: AI Generation
1. Create `services/quiz_generator.py`
2. Integrate with existing LLM service
3. Parse and validate LLM JSON responses
4. Handle generation errors gracefully

### Phase 5: Testing
1. Unit tests for database methods (SQLite + PostgreSQL)
2. Integration tests for endpoints
3. Test AI generation with sample media

---

## Critical Files (Backend)

**Create:**
- `tldw_Server_API/app/api/v1/schemas/quizzes.py`
- `tldw_Server_API/app/api/v1/endpoints/quizzes.py`
- `tldw_Server_API/app/services/quiz_generator.py`

**Modify:**
- `tldw_Server_API/app/core/DB_Management/ChaChaNotes_DB.py` - Add quiz tables and methods
- `tldw_Server_API/app/main.py` - Register quizzes router

**Reference:**
- `tldw_Server_API/app/api/v1/endpoints/flashcards.py` - Endpoint patterns
- `tldw_Server_API/app/api/v1/schemas/flashcards.py` - Schema patterns
- `custom-extension/src/services/quizzes.ts` - Frontend API contract

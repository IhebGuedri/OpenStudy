from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class StartPlanRequest(BaseModel):
    description: str = Field(min_length=5)
    topic: Optional[str] = None


class RevisePlanRequest(BaseModel):
    session_id: str
    feedback: str = ""
    manual_title: Optional[str] = None
    manual_plan: Optional[List[str]] = None


class AcceptPlanRequest(BaseModel):
    session_id: str
    final_title: Optional[str] = None
    final_plan: Optional[List[str]] = None


class GenerateNextChapterRequest(BaseModel):
    session_id: str


class ChapterConversationRequest(BaseModel):
    course_title: str
    chapter_title: str
    question: str = Field(min_length=2)
    existing_sections: List[str] = []


class CourseSummaryChapter(BaseModel):
    titre: str
    sections: List[str] = Field(default_factory=list)


class CourseSummaryRequest(BaseModel):
    course_title: str = Field(min_length=1)
    chapters: List[CourseSummaryChapter] = Field(default_factory=list)


class PlanResponse(BaseModel):
    session_id: str
    title: str
    chapters: List[str]
    iteration: int
    accepted: bool


class GenerateNextChapterResponse(BaseModel):
    session_id: str
    done: bool
    chapter_index: int
    total_chapters: int
    chapter_title: Optional[str] = None
    content: Optional[str] = None
    prompt_source: Optional[str] = None


class ChapterConversationResponse(BaseModel):
    answer: str
    prompt_source: str


class CourseSummaryResponse(BaseModel):
    summary: str
    prompt_source: str


class HealthResponse(BaseModel):
    status: str


class NormalizedPlan(BaseModel):
    title: str
    chapters: List[str]

    @field_validator("chapters")
    @classmethod
    def check_chapters(cls, value: List[str]) -> List[str]:
        cleaned = [item.strip() for item in value if item and item.strip()]
        if not cleaned:
            raise ValueError("At least one chapter is required")
        return cleaned

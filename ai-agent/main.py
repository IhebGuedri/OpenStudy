from __future__ import annotations

import uuid
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.flows.course_flow import (
    build_chapter_graph,
    build_plan_graph,
    build_youtube_search_url,
    find_best_youtube_video,
    generate_conversation_reply,
    generate_course_summary,
)
from app.models.schemas import (
    AcceptPlanRequest,
    ChapterConversationRequest,
    ChapterConversationResponse,
    CourseSummaryRequest,
    CourseSummaryResponse,
    GenerateNextChapterRequest,
    GenerateNextChapterResponse,
    HealthResponse,
    PlanResponse,
    RevisePlanRequest,
    StartPlanRequest,
)

load_dotenv()

app = FastAPI(title="openStudy ai-agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

plan_graph = build_plan_graph()
chapter_graph = build_chapter_graph()

# In-memory state for development. Replace with persistent store for production.
sessions: Dict[str, Dict[str, Any]] = {}


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/api/course-plan/start", response_model=PlanResponse)
def start_plan(request: StartPlanRequest) -> PlanResponse:
    session_id = str(uuid.uuid4())
    state = {
        "topic": (request.topic or "").strip(),
        "description": request.description.strip(),
        "feedback": "",
        "manual_title": "",
        "manual_plan": [],
        "title": "",
        "chapters": [],
    }
    result = plan_graph.invoke(state)

    sessions[session_id] = {
        "title": result["title"],
        "chapters": result["chapters"],
        "iteration": 1,
        "accepted": False,
        "chapter_cursor": 0,
        "generated_chapters": [],
        "description": request.description.strip(),
        "topic": (request.topic or "").strip(),
    }

    return PlanResponse(
        session_id=session_id,
        title=result["title"],
        chapters=result["chapters"],
        iteration=1,
        accepted=False,
    )


@app.post("/api/course-plan/revise", response_model=PlanResponse)
def revise_plan(request: RevisePlanRequest) -> PlanResponse:
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    state = {
        "topic": session.get("topic", ""),
        "description": session.get("description", ""),
        "feedback": request.feedback.strip(),
        "manual_title": (request.manual_title or "").strip(),
        "manual_plan": [item.strip() for item in (request.manual_plan or []) if item.strip()],
        "title": session["title"],
        "chapters": session["chapters"],
    }
    result = plan_graph.invoke(state)

    session["title"] = result["title"]
    session["chapters"] = result["chapters"]
    session["iteration"] = int(session.get("iteration", 1)) + 1
    session["accepted"] = False

    return PlanResponse(
        session_id=request.session_id,
        title=session["title"],
        chapters=session["chapters"],
        iteration=session["iteration"],
        accepted=False,
    )


@app.post("/api/course-plan/accept", response_model=PlanResponse)
def accept_plan(request: AcceptPlanRequest) -> PlanResponse:
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if request.final_title and request.final_title.strip():
        session["title"] = request.final_title.strip()

    if request.final_plan:
        cleaned = [item.strip() for item in request.final_plan if item and item.strip()]
        if cleaned:
            session["chapters"] = cleaned

    if not session["chapters"]:
        raise HTTPException(status_code=400, detail="Plan is empty")

    session["accepted"] = True
    session["chapter_cursor"] = 0
    session["generated_chapters"] = []
    session["youtube_video"] = find_best_youtube_video(
        course_title=session["title"],
        chapters=session["chapters"],
    )

    return PlanResponse(
        session_id=request.session_id,
        title=session["title"],
        chapters=session["chapters"],
        iteration=session["iteration"],
        accepted=True,
    )


@app.post("/api/course-content/generate-next-chapter", response_model=GenerateNextChapterResponse)
def generate_next_chapter(request: GenerateNextChapterRequest) -> GenerateNextChapterResponse:
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.get("accepted"):
        raise HTTPException(status_code=400, detail="Plan must be accepted first")

    chapters: List[str] = session["chapters"]
    cursor: int = int(session.get("chapter_cursor", 0))
    youtube_video = session.get("youtube_video") or {}
    if not youtube_video.get("url"):
        youtube_video = find_best_youtube_video(
            course_title=session.get("title", ""),
            chapters=chapters,
        )
        if not youtube_video.get("url"):
            youtube_video = {
                "title": "Rechercher une video YouTube recommandee",
                "url": build_youtube_search_url(session.get("title", ""), chapters),
                "video_id": "",
            }
        session["youtube_video"] = youtube_video

    youtube_video_url = youtube_video.get("url")
    youtube_video_title = youtube_video.get("title")

    if cursor >= len(chapters):
        return GenerateNextChapterResponse(
            session_id=request.session_id,
            done=True,
            chapter_index=cursor,
            total_chapters=len(chapters),
            youtube_video_url=youtube_video_url,
            youtube_video_title=youtube_video_title,
        )

    chapter_title = chapters[cursor]
    state = {
        "course_title": session["title"],
        "chapter_title": chapter_title,
        "chapter_index": cursor,
        "total_chapters": len(chapters),
        "previous_chapters": session.get("generated_chapters", []),
        "content": "",
    }
    result = chapter_graph.invoke(state)

    content = result["content"]
    is_last_chapter = cursor == len(chapters) - 1
    if is_last_chapter and youtube_video_url:
        content = (
            f"{content.rstrip()}\n\n"
            "## Video recommandee\n\n"
            f"[{youtube_video_title or 'Voir la video YouTube'}]({youtube_video_url})\n"
        )

    prompt_source = f"session={request.session_id};chapter_index={cursor};title={chapter_title}"

    session["generated_chapters"].append({"title": chapter_title, "content": content})
    session["chapter_cursor"] = cursor + 1

    return GenerateNextChapterResponse(
        session_id=request.session_id,
        done=False,
        chapter_index=cursor,
        total_chapters=len(chapters),
        chapter_title=chapter_title,
        content=content,
        prompt_source=prompt_source,
        youtube_video_url=youtube_video_url if is_last_chapter else None,
        youtube_video_title=youtube_video_title if is_last_chapter else None,
    )


@app.post("/api/chapter-conversation/reply", response_model=ChapterConversationResponse)
def chapter_conversation_reply(request: ChapterConversationRequest) -> ChapterConversationResponse:
    answer = generate_conversation_reply(
        course_title=request.course_title.strip(),
        chapter_title=request.chapter_title.strip(),
        question=request.question.strip(),
        existing_sections=request.existing_sections,
    )
    prompt_source = f"course={request.course_title};chapter={request.chapter_title};question={request.question}"
    return ChapterConversationResponse(answer=answer, prompt_source=prompt_source)


@app.post("/api/course-summary/generate", response_model=CourseSummaryResponse)
def course_summary_generate(request: CourseSummaryRequest) -> CourseSummaryResponse:
    chapters = [chapter.model_dump() for chapter in request.chapters]
    summary = generate_course_summary(
        course_title=request.course_title.strip(),
        chapters=chapters,
    )
    prompt_source = f"course={request.course_title};chapters={len(chapters)}"
    return CourseSummaryResponse(summary=summary, prompt_source=prompt_source)

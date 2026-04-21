from __future__ import annotations

import json
import os
from typing import Any, Dict, List, TypedDict
from urllib.error import URLError
from urllib.parse import quote_plus
from urllib.request import urlopen

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, StateGraph

from app.models.schemas import NormalizedPlan


class PlanGraphState(TypedDict):
    topic: str
    description: str
    feedback: str
    manual_title: str
    manual_plan: List[str]
    title: str
    chapters: List[str]


class ChapterGraphState(TypedDict):
    course_title: str
    chapter_title: str
    chapter_index: int
    total_chapters: int
    previous_chapters: List[Dict[str, Any]]
    content: str


class SummaryGraphState(TypedDict):
    course_title: str
    chapters: List[Dict[str, Any]]
    summary: str


def _get_llm() -> ChatGoogleGenerativeAI | None:
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key:
        return None

    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.4,
        google_api_key=api_key,
    )


def _fallback_plan(state: PlanGraphState) -> NormalizedPlan:
    base = state["topic"].strip() or state["description"].strip().split(".")[0]
    title = state["manual_title"].strip() or f"Parcours complet: {base}"[:100]

    if state["manual_plan"]:
        return NormalizedPlan(title=title, chapters=state["manual_plan"])

    description = state["description"].replace("\n", " ").strip()
    fragments = [item.strip() for item in description.split(".") if item.strip()]
    generated = []
    for idx, fragment in enumerate(fragments[:6], start=1):
        generated.append(f"Chapitre {idx}: {fragment[:80]}")

    if not generated:
        generated = [
            "Chapitre 1: Introduction",
            "Chapitre 2: Concepts fondamentaux",
            "Chapitre 3: Mise en pratique",
            "Chapitre 4: Cas reels",
            "Chapitre 5: Synthese et projet final",
        ]

    return NormalizedPlan(title=title, chapters=generated)


def _generate_plan_node(state: PlanGraphState) -> PlanGraphState:
    llm = _get_llm()
    if llm is None:
        plan = _fallback_plan(state)
        return {**state, "title": plan.title, "chapters": plan.chapters}

    prompt = (
        "Tu es un expert pedagogique. Cree un plan de cours clair en francais. "
        "Reponds strictement en JSON avec ce schema: "
        "{\"title\": string, \"chapters\": string[]}. "
        "Entre 4 et 8 chapitres.\n"
        f"Topic: {state['topic']}\n"
        f"Description: {state['description']}\n"
        f"Feedback utilisateur: {state['feedback']}\n"
        f"Titre manuel propose: {state['manual_title']}\n"
        f"Plan manuel propose: {json.dumps(state['manual_plan'], ensure_ascii=True)}\n"
    )

    raw = llm.invoke(prompt).content
    text = raw if isinstance(raw, str) else str(raw)
    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        plan = _fallback_plan(state)
        return {**state, "title": plan.title, "chapters": plan.chapters}

    try:
        payload = json.loads(text[start : end + 1])
        plan = NormalizedPlan.model_validate(payload)
        return {**state, "title": plan.title, "chapters": plan.chapters}
    except Exception:
        plan = _fallback_plan(state)
        return {**state, "title": plan.title, "chapters": plan.chapters}


def _validate_plan_node(state: PlanGraphState) -> PlanGraphState:
    plan = NormalizedPlan(
        title=state["title"].strip() or "Nouveau cours",
        chapters=state["chapters"],
    )
    return {**state, "title": plan.title, "chapters": plan.chapters}


def _generate_chapter_node(state: ChapterGraphState) -> ChapterGraphState:
    llm = _get_llm()
    if llm is None:
        content = (
            f"# {state['chapter_title']}\n\n"
            f"Objectif: Comprendre le chapitre {state['chapter_index'] + 1} sur {state['course_title']}.\n\n"
            "1. Concept cle\n"
            "2. Explication detaillee\n"
            "3. Exemple pratique\n"
            "4. Mini exercice\n"
            "5. Resume\n"
        )
        return {**state, "content": content}

    prompt = (
        "Tu rediges un contenu de cours en markdown, pedagogique et progressif, en francais. "
        "Donne un texte complet pour un seul chapitre avec exemples et mini exercice.\n"
        f"Cours: {state['course_title']}\n"
        f"Chapitre ({state['chapter_index'] + 1}/{state['total_chapters']}): {state['chapter_title']}\n"
        f"Historique des chapitres deja traites: {json.dumps(state['previous_chapters'], ensure_ascii=True)}\n"
    )
    raw = llm.invoke(prompt).content
    text = raw if isinstance(raw, str) else str(raw)
    return {**state, "content": text.strip()}


def generate_conversation_reply(
    course_title: str,
    chapter_title: str,
    question: str,
    existing_sections: List[str],
) -> str:
    llm = _get_llm()
    if llm is None:
        return (
            f"Réponse sur le chapitre '{chapter_title}':\n\n"
            f"Tu as demandé: {question}\n\n"
            "Explication:\n"
            "1. Reformulation du concept\n"
            "2. Exemple concret\n"
            "3. Point d'attention\n"
            "4. Mini exercice\n"
        )

    prompt = (
        "Tu es un tuteur pedagogique. Reponds en francais, de maniere claire et concise. "
        "La reponse doit etre specifique au chapitre courant.\n"
        f"Cours: {course_title}\n"
        f"Chapitre actuel: {chapter_title}\n"
        f"Question etudiant: {question}\n"
        f"Contenu deja present dans ce chapitre: {json.dumps(existing_sections, ensure_ascii=True)}\n"
        "Contraintes: reponse utile, structurée, sans sortir du sujet du chapitre."
    )
    raw = llm.invoke(prompt).content
    text = raw if isinstance(raw, str) else str(raw)
    return text.strip()


def _fallback_course_summary(state: SummaryGraphState) -> SummaryGraphState:
    course_title = state["course_title"].strip() or "Cours"
    chapters = state["chapters"]

    lines = [
        f"# Résumé de {course_title}",
        "",
        "## Idée générale",
        "Ce cours présente les notions essentielles à retenir et une progression simple chapitre par chapitre.",
    ]

    if chapters:
        lines.extend(["", "## Points clés"])
        for index, chapter in enumerate(chapters[:8], start=1):
            chapter_title = str(chapter.get("titre", f"Chapitre {index}")).strip() or f"Chapitre {index}"
            sections = chapter.get("sections") or []
            section_excerpt = ""
            if sections:
                first_section = str(sections[0]).strip()
                if len(first_section) > 160:
                    first_section = first_section[:157].rstrip() + "..."
                section_excerpt = f" - {first_section}"
            lines.append(f"- {chapter_title}{section_excerpt}")
    else:
        lines.extend(["", "## Points clés", "- Aucun chapitre n'a été trouvé dans ce cours."])

    lines.extend([
        "",
        "## À retenir",
        "Relire les titres de chapitres, les sections générées et refaire les exercices ou exemples associés.",
    ])

    return {**state, "summary": "\n".join(lines).strip()}


def generate_course_summary(course_title: str, chapters: List[Dict[str, Any]]) -> str:
    llm = _get_llm()
    if llm is None:
        return _fallback_course_summary({"course_title": course_title, "chapters": chapters, "summary": ""})["summary"]

    prompt = (
        "Tu es un assistant pedagogique. Redige un résumé simple et utile en francais pour un étudiant. "
        "Le résumé doit rester court, clair, et structuré en markdown avec les sections: '# Résumé', '## Idée générale', '## Points clés', '## À retenir'. "
        "N'invente pas de contenu absent des chapitres. Si des sections sont fournies, synthétise-les sans tout recopier.\n"
        f"Cours: {course_title}\n"
        f"Chapitres: {json.dumps(chapters, ensure_ascii=True)}\n"
    )

    raw = llm.invoke(prompt).content
    text = raw if isinstance(raw, str) else str(raw)
    cleaned = text.strip()
    if not cleaned:
        return _fallback_course_summary({"course_title": course_title, "chapters": chapters, "summary": ""})["summary"]
    return cleaned


def build_plan_graph():
    graph = StateGraph(PlanGraphState)
    graph.add_node("generate_plan", _generate_plan_node)
    graph.add_node("validate_plan", _validate_plan_node)

    graph.set_entry_point("generate_plan")
    graph.add_edge("generate_plan", "validate_plan")
    graph.add_edge("validate_plan", END)
    return graph.compile()


def build_chapter_graph():
    graph = StateGraph(ChapterGraphState)
    graph.add_node("generate_chapter", _generate_chapter_node)
    graph.set_entry_point("generate_chapter")
    graph.add_edge("generate_chapter", END)
    return graph.compile()


def _safe_int(value: Any) -> int:
    try:
        return int(value)
    except Exception:
        return 0


def build_youtube_search_url(course_title: str, chapters: List[str]) -> str:
    topic_hint = " ".join([chapter.strip() for chapter in chapters[:4] if chapter and chapter.strip()])
    query = f"{course_title} {topic_hint}".strip()
    if not query:
        query = course_title.strip() or "cours"
    return f"https://www.youtube.com/results?search_query={quote_plus(query)}"


def find_best_youtube_video(course_title: str, chapters: List[str]) -> Dict[str, str]:
    """Find a relevant and popular YouTube video for the course plan."""
    api_key = os.getenv("YOUTUBE_API_KEY", "").strip()
    fallback = {
        "title": "Rechercher une video YouTube recommandee",
        "url": build_youtube_search_url(course_title, chapters),
        "video_id": "",
    }

    if not api_key:
        return fallback

    topic_hint = " ".join([chapter.strip() for chapter in chapters[:4] if chapter and chapter.strip()])
    query = f"{course_title} {topic_hint}".strip()
    if not query:
        return fallback

    search_url = (
        "https://www.googleapis.com/youtube/v3/search"
        f"?part=snippet&type=video&maxResults=5&order=relevance&q={quote_plus(query)}&key={quote_plus(api_key)}"
    )

    try:
        with urlopen(search_url, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (URLError, TimeoutError, ValueError):
        return fallback

    items = payload.get("items") or []
    candidates: List[Dict[str, str]] = []
    video_ids: List[str] = []
    for item in items:
        video_id = str(((item.get("id") or {}).get("videoId") or "")).strip()
        if not video_id:
            continue

        title = str(((item.get("snippet") or {}).get("title") or "")).strip()
        candidates.append({"video_id": video_id, "title": title})
        video_ids.append(video_id)

    if not candidates:
        return fallback

    stats_by_id: Dict[str, int] = {}
    stats_url = (
        "https://www.googleapis.com/youtube/v3/videos"
        f"?part=statistics&id={quote_plus(','.join(video_ids))}&key={quote_plus(api_key)}"
    )

    try:
        with urlopen(stats_url, timeout=10) as response:
            stats_payload = json.loads(response.read().decode("utf-8"))
        for item in stats_payload.get("items") or []:
            video_id = str(item.get("id") or "").strip()
            view_count = _safe_int(((item.get("statistics") or {}).get("viewCount")))
            if video_id:
                stats_by_id[video_id] = view_count
    except (URLError, TimeoutError, ValueError):
        pass

    best = max(candidates, key=lambda item: stats_by_id.get(item["video_id"], 0))
    video_id = best["video_id"]
    return {
        "title": best.get("title", ""),
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "video_id": video_id,
    }

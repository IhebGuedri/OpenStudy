# openStudy ai-agent

Service FastAPI + LangGraph pour generation de plan de cours et contenu chapitre par chapitre.

## Setup

1. Activer le venv:

```powershell
venv\Scripts\activate
```

2. Installer les dependances:

```powershell
python -m pip install -r requirements.txt
```

3. Configurer les cles API (optionnel si vous acceptez le fallback local):

```powershell
copy .env.example .env
# puis remplir GOOGLE_API_KEY et/ou YOUTUBE_API_KEY
```

4. Lancer le serveur:

```powershell
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health`
- `POST /api/course-plan/start`
- `POST /api/course-plan/revise`
- `POST /api/course-plan/accept`
- `POST /api/course-content/generate-next-chapter`

Le endpoint de generation de chapitre renvoie aussi `youtube_video_url` et `youtube_video_title` sur le dernier chapitre genere (si `YOUTUBE_API_KEY` est configuree).

## Notes

- Pas d auth dans cette version.
- Etat en memoire (sessions) pour le MVP.

# Local development

The scanner runs on the backend machine. Enter a backend-local directory path
or a public GitHub repository URL; a path on a different computer is not
accessible to the API.

For local scanning, set `VITE_API_URL=http://127.0.0.1:8000` in
`frontend/.env.local`, start the FastAPI backend with
`uvicorn backend.main:app --reload --port 8000` from the repository root, and
start the frontend with `npm run dev` from `frontend`.

For a deployed frontend, set its `VITE_API_URL` to the deployed backend URL
before building. Set `CORS_ORIGINS` on the backend to a comma-separated list
of the deployed frontend origins (for example, `https://example.com`). Keep
the local origins listed in `backend/.env.example` when local development is
also needed.

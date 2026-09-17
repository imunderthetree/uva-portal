# UVa Judge Portal

A modern, high-velocity web portal for UVa Online Judge (`onlinejudge.org`). Browse 10,000+ problems with integrated in-portal PDF statements, submit solutions across multiple languages, stream live verdict queues, curate private problem sheets with access passkeys, host timed ACM-ICPC contests with real-time scoreboards, and inspect your past source code.

---

## Key Features

* **In-Portal PDF Statements**: Proxied and cached server-side for clean side-by-side reading next to the submission editor — no popups or broken redirects.
* **Live Asynchronous Verdict Streaming**: Polling engine streams judge queue states (`In judge queue`, `Compiling`, `Running`) to final verdicts without page reloads.
* **Source Code Archival & Inspection**: View the exact source code submitted for any run directly in the Submissions panel with one-click copy.
* **Private Sheets & Contests**: Create training collections or timed ICPC contests with passkey control, ACM 20-minute penalty calculation, and live problem scoreboards.
* **Comprehensive Profile Analytics**: View DACU-derived difficulty tiers (Beginner to Master), topic category mastery bars, acceptance rate metrics, and custom profile avatars.
* **Unified Single-Port Deployment**: Production build serves both the React UI and Flask API from a single port (`8080`), eliminating CORS configuration.

---

## Quick Start (Local Development)

### 1. Backend

```bash
cd backend
python -m venv venv
# Linux / macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

pip install -r requirements.txt
python app.py
```
Backend runs on `http://localhost:5000`.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173` and proxies `/api/*` to the Flask backend.

---

## Production Deployment with Docker

The project includes a multi-stage `Dockerfile` and `docker-compose.yml` that builds the React application and serves the entire unified application on port `8080` with Gunicorn.

### Run with Docker Compose:

```bash
# Build and launch
docker compose up --build -d

# View logs
docker compose logs -f
```

The portal is immediately live at `http://localhost:8080`.

### Persistent Storage
The database and cached problem statement PDFs are persisted to the `./uva_data` volume mount (`/data` inside the container):
* `/data/uva_portal.db` — SQLite database with WAL mode enabled.
* `/data/pdf_cache/` — Cached problem statements.

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `FLASK_ENV` | `development` | Set to `production` in production environments. |
| `FLASK_SECRET_KEY` | *(auto-generated)* | 32-byte secret key used to sign session cookies. **Mandatory in production.** |
| `DATA_DIR` | *(local directory)* | Directory path for persistent storage (`uva_portal.db` and `pdf_cache/`). |
| `PORT` | `8080` (Docker) / `5000` | Port for the WSGI application server. |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin during dual-port development. |

---

## Healthcheck & Monitoring

Container orchestrators (Railway, Render, Fly.io, Kubernetes) can probe the live healthcheck endpoint:

```http
GET /api/health
```

**Response (`200 OK`):**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-09-17T12:00:00.000000+00:00",
  "version": "1.0.0"
}
```

---

## Automated Tests

Run backend unit tests with isolated test database:

```bash
cd backend
python -m unittest test_backend.py
```

Build the production frontend bundle:

```bash
cd frontend
npm run build
```

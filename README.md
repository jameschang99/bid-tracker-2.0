# Bid Tracker

Three parts:

```
bid-tracker/
├─ backend/     Express + Mongoose API (docker-compose.yml runs MongoDB)
├─ extension/   Chrome/Edge (Manifest V3): press Ctrl + .  on a job page to save it
└─ frontend/    React (Vite) web app: daily view, select / edit / delete, CSV export
```

The extension runs on standard web pages. Upwork, Freelancer, and Ashby have dedicated extraction adapters;
other sites use generic title, metadata, structured job data, and label extraction. Browser-internal pages
such as `chrome://` cannot be accessed by extensions.

## 1. Backend
```bash
cd backend
docker compose up -d          # MongoDB (or use Atlas / a local install and set MONGODB_URI)
cp .env.example .env          # set API_KEY (and MONGODB_URI if not local)
npm install
npm run dev                   # http://localhost:4000
```

Optional hosted AI enrichment: set `AI_ENABLED=true`, `AI_MODEL`, `AI_API_URL`, and `AI_API_KEY` in
`backend/.env`, then restart the backend. The default uses an OpenAI-compatible chat-completions endpoint.
On each save, the backend sends extracted job fields and page text to the provider; it does not send username,
job URL, or API keys in the prompt. The API key stays on the backend. AI fills only missing or placeholder
fields, and normal extraction continues if the provider is unavailable or times out. Page text is sent to the
configured provider and may be subject to its data policy; model output should be reviewed.

## 2. Extension
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension/`.
2. Open the extension **Options**: set a username, API URL (`http://localhost:4000`), and the same API key as `.env`.
3. On a job page press **Ctrl + .** — a toast shows "job work added success" (or "job work added fail" if it could not be saved; the reason is in the F12 console). Pressing it again on the same job updates the entry.
   After updating the extension, reload it in `chrome://extensions` and refresh the job tab.

Saved per entry: bid sent status, username, platform, job title, company, location, location type, **employment type**,
**salary**, salary method, work content, job URL. Salary is stored as the exact text shown on the page (no number
parsing). The day an entry belongs to is its creation time (set by the server).

## 3. Web app
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :4000; listens on LAN)
```
Open it, enter the API key in **Settings**, and:
- Browse by day (sidebar, ◀ ▶, date picker, Today, All days) and search.
- Tick rows (or the header box) to select; **Delete selected**; per-row **Edit** / **Delete**.
- **Export CSV** downloads exactly what is displayed (or only the selected rows if any are ticked).

For another device on the same LAN, open `http://<host-lan-ip>:5173` (find the host IP with `ipconfig`).
Keep the host and client on the same trusted network; this development server does not provide user-specific
data isolation.

Production: `npm run build` in `frontend/`, then the backend serves `frontend/dist` at `http://localhost:4000/`.

## API (header `x-api-key` required except /health)
| Method | Path | Notes |
|---|---|---|
| POST | /api/bids | Upsert by platform + job URL |
| GET | /api/bids?limit=500&platform=ashby | Newest first |
| PATCH | /api/bids/:id | Edit fields |
| DELETE | /api/bids/:id | |
| POST | /api/bids/bulk-delete | `{ "ids": [...] }` |
| GET | /api/health | No auth |

## Tuning selectors
All scraping lives in `ADAPTERS` at the top of `extension/content.js`. Open DevTools (F12) → Console on a job
page, press Ctrl + ., and read the `[BidTracker] sending` line to see what was extracted. If a field is empty,
inspect that element, update the selector, reload the extension.

## Deploying
Host the API behind HTTPS, add its origin to `host_permissions` in `extension/manifest.json`, and put it in the Options page.

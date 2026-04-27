# project B, browser automation price tracker
# NOTE : This was generated with Cluade code as a workshop from Prog@GSU,

a full-stack price tracker. paste a product URL, headless chromium scrapes the price, sqlite stores history, and recharts draws the line. the `playwright` MCP lets claude drive a real browser during development to find the right selectors without guessing.

## difficulty
**medium to hard**, pick this if you want to see what MCP-driven browser automation actually feels like. it's the flashier demo.

## time
~75–90 minutes

## stack
- **frontend:** next.js 15 + typescript + tailwind + recharts (deployed to vercel)
- **backend:** fastapi (python 3.11+), managed with `uv`
- **scraper:** playwright for python, headless chromium
- **storage:** sqlite (local file)

## MCPs used
- `context7`, fastapi, playwright, recharts docs
- `github`, create the repo and push
- `vercel`, deploy the frontend
- `playwright`, **the star of the show**, drives a real browser during development

## subagents used
- `debugger`, for when a scrape fails or a selector breaks

## skills used
- `everything-claude-code-conventions`, consistent commit messages

## how to start
1. have 1–2 real product URLs ready for testing (avoid Amazon if possible, bot detection is rough)
2. launch claude code from this folder: `claude`
3. paste the prompt from [`PROMPT.md`](./PROMPT.md)
4. **use the `playwright` MCP interactively** to find selectors before writing scraper code

full walkthrough is in the root [`GUIDE.md`](../../GUIDE.md) → section 7.

## repo layout (after build)
```
.
├── frontend/          # next.js app
└── backend/           # fastapi + scraper + sqlite
    ├── app/
    │   ├── main.py
    │   ├── db.py
    │   └── scraper.py
    └── pyproject.toml
```

## running locally

### one-time setup (first clone)
```bash
# install playwright browser (Python, inside backend/)
cd backend
uv sync
uv run playwright install chromium
cd ..
```

### backend
```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### frontend (separate terminal)
```bash
cd frontend
pnpm install
pnpm dev
# App at http://localhost:3000
```

### testing
The scraper works best with sites that don't have aggressive bot detection.
**Reliable test URLs:**
- `https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html` (sandbox, always works)
- `https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html`
- Any site with `og:price:amount` or `product:price:amount` meta tags

Amazon and Best Buy require site-specific selectors (implemented in `backend/app/scraper.py`) but may be blocked by bot detection.

## api reference
| Method | Path | Description |
|--------|------|-------------|
| POST | `/items` | Add a URL to track (kicks off scrape) |
| GET | `/items` | List all tracked items with latest price |
| GET | `/items/{id}/history` | Full price history for charting |
| POST | `/items/{id}/refresh` | Re-scrape one item |
| POST | `/refresh-all` | Re-scrape all tracked items |

## deploy note
only the **frontend** is deployed to vercel. the backend runs locally. turning this into a fully production-deployed app is a stretch goal.

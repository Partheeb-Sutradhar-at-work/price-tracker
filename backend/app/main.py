import logging
from contextlib import asynccontextmanager

import aiosqlite
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.db import get_db, init_db
from app.scraper import ScraperError, scrape_product

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = await get_db()
    await init_db(db)
    app.state.db = db
    yield
    await db.close()


app = FastAPI(title="Price Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AddItemRequest(BaseModel):
    url: str


def _db(request: Request) -> aiosqlite.Connection:
    return request.app.state.db


@app.post("/items", status_code=201)
async def add_item(body: AddItemRequest, request: Request):
    db = _db(request)
    url = body.url.strip()

    try:
        result = await scrape_product(url)
    except ScraperError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    async with db.execute("SELECT id FROM items WHERE url = ?", (url,)) as cur:
        existing = await cur.fetchone()

    if existing:
        item_id = existing["id"]
        await db.execute(
            "UPDATE items SET title=?, image_url=? WHERE id=?",
            (result.title, result.image_url, item_id),
        )
    else:
        async with db.execute(
            "INSERT INTO items (url, title, image_url) VALUES (?, ?, ?)",
            (url, result.title, result.image_url),
        ) as cur:
            item_id = cur.lastrowid

    await db.execute(
        "INSERT INTO price_history (item_id, price) VALUES (?, ?)",
        (item_id, result.price),
    )
    await db.commit()

    return {"id": item_id, "url": url, "title": result.title, "image_url": result.image_url, "price": result.price}


@app.get("/items")
async def list_items(request: Request):
    db = _db(request)
    async with db.execute("""
        SELECT i.id, i.url, i.title, i.image_url, i.created_at,
               ph.price AS latest_price, ph.scraped_at AS last_scraped
        FROM items i
        LEFT JOIN price_history ph ON ph.item_id = i.id
          AND ph.scraped_at = (
              SELECT MAX(scraped_at) FROM price_history WHERE item_id = i.id
          )
        ORDER BY i.created_at DESC
    """) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@app.get("/items/{item_id}/history")
async def item_history(item_id: int, request: Request):
    db = _db(request)
    async with db.execute("SELECT id FROM items WHERE id = ?", (item_id,)) as cur:
        if not await cur.fetchone():
            raise HTTPException(status_code=404, detail="Item not found")

    async with db.execute(
        "SELECT price, scraped_at FROM price_history WHERE item_id = ? ORDER BY scraped_at ASC",
        (item_id,),
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@app.post("/items/{item_id}/refresh")
async def refresh_item(item_id: int, request: Request):
    db = _db(request)
    async with db.execute("SELECT * FROM items WHERE id = ?", (item_id,)) as cur:
        item = await cur.fetchone()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    try:
        result = await scrape_product(item["url"])
    except ScraperError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    await db.execute(
        "UPDATE items SET title=?, image_url=? WHERE id=?",
        (result.title, result.image_url, item_id),
    )
    await db.execute(
        "INSERT INTO price_history (item_id, price) VALUES (?, ?)",
        (item_id, result.price),
    )
    await db.commit()

    return {"id": item_id, "price": result.price, "title": result.title, "image_url": result.image_url}


@app.post("/refresh-all")
async def refresh_all(request: Request):
    db = _db(request)
    async with db.execute("SELECT id, url FROM items") as cur:
        items = await cur.fetchall()

    results = []
    for item in items:
        try:
            result = await scrape_product(item["url"])
            await db.execute(
                "INSERT INTO price_history (item_id, price) VALUES (?, ?)",
                (item["id"], result.price),
            )
            results.append({"id": item["id"], "price": result.price, "ok": True})
        except ScraperError as exc:
            results.append({"id": item["id"], "ok": False, "error": str(exc)})

    await db.commit()
    return results

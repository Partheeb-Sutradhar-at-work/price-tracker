import aiosqlite
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "prices.db"


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db(db: aiosqlite.Connection) -> None:
    await db.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL UNIQUE,
            title TEXT,
            image_url TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL REFERENCES items(id),
            price REAL NOT NULL,
            scraped_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    await db.commit()

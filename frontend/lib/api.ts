const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface TrackedItem {
  id: number;
  url: string;
  title: string | null;
  image_url: string | null;
  created_at: string;
  latest_price: number | null;
  last_scraped: string | null;
}

export interface PricePoint {
  price: number;
  scraped_at: string;
}

export async function addItem(url: string): Promise<TrackedItem> {
  const res = await fetch(`${BASE_URL}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to add item");
  }
  return res.json();
}

export async function listItems(): Promise<TrackedItem[]> {
  const res = await fetch(`${BASE_URL}/items`);
  if (!res.ok) throw new Error("Failed to fetch items");
  return res.json();
}

export async function getHistory(itemId: number): Promise<PricePoint[]> {
  const res = await fetch(`${BASE_URL}/items/${itemId}/history`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function refreshItem(itemId: number): Promise<TrackedItem> {
  const res = await fetch(`${BASE_URL}/items/${itemId}/refresh`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to refresh item");
  }
  return res.json();
}

export async function refreshAll(): Promise<unknown[]> {
  const res = await fetch(`${BASE_URL}/refresh-all`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to refresh all");
  return res.json();
}

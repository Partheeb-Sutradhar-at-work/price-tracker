"use client";

import { useState, useEffect, useCallback } from "react";
import { TrackedItem, addItem, listItems, refreshAll } from "@/lib/api";
import ItemCard from "@/components/ItemCard";

export default function Home() {
  const [url, setUrl] = useState("");
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const data = await listItems();
      setItems(data);
    } catch {
      // silently fail on background refresh
    } finally {
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const newItem = await addItem(url.trim());
      setItems((prev) => {
        const exists = prev.find((i) => i.id === newItem.id);
        if (exists) return prev.map((i) => (i.id === newItem.id ? { ...i, ...newItem } : i));
        return [newItem as TrackedItem, ...prev];
      });
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to track item");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshAll() {
    setRefreshingAll(true);
    setError(null);
    try {
      await refreshAll();
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh all failed");
    } finally {
      setRefreshingAll(false);
    }
  }

  function handleItemRefreshed(updated: TrackedItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Price Tracker</h1>
          <p className="text-gray-400">Paste any product URL to start tracking its price over time.</p>
        </div>

        <form onSubmit={handleTrack} className="flex gap-2 mb-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.amazon.com/dp/..."
            required
            className="flex-1 rounded-lg bg-gray-800 border border-gray-600 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            {loading ? "Tracking…" : "Track"}
          </button>
        </form>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-300 text-sm">
            {error}
          </div>
        )}

        {items.length > 0 && (
          <div className="flex justify-end mb-4">
            <button
              onClick={handleRefreshAll}
              disabled={refreshingAll}
              className="text-sm px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-400 disabled:opacity-50 text-gray-300 transition-colors"
            >
              {refreshingAll ? "Refreshing all…" : "Refresh all"}
            </button>
          </div>
        )}

        {initialLoad ? (
          <div className="text-center text-gray-500 py-12">Loading tracked items…</div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-500 py-12 border border-dashed border-gray-700 rounded-xl">
            No items tracked yet. Paste a product URL above to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onRefreshed={handleItemRefreshed} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

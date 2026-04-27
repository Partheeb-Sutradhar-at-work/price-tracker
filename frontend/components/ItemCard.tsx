"use client";

import { useState } from "react";
import Image from "next/image";
import { TrackedItem, PricePoint, getHistory, refreshItem } from "@/lib/api";
import PriceChart from "./PriceChart";

interface ItemCardProps {
  item: TrackedItem;
  onRefreshed: (updated: TrackedItem) => void;
}

export default function ItemCard({ item, onRefreshed }: ItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    setLoadingHistory(true);
    try {
      const h = await getHistory(item.id);
      setHistory(h);
    } catch {
      setError("Could not load price history.");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    setRefreshing(true);
    setError(null);
    try {
      const updated = await refreshItem(item.id);
      onRefreshed({ ...item, ...updated });
      if (expanded) {
        const h = await getHistory(item.id);
        setHistory(h);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={handleExpand}
      >
        {item.image_url ? (
          <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-700">
            <Image
              src={item.image_url}
              alt={item.title ?? "Product"}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-gray-700 flex items-center justify-center">
            <span className="text-2xl">📦</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{item.title ?? item.url}</p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{item.url}</p>
          {item.last_scraped && (
            <p className="text-xs text-gray-500 mt-0.5">
              Updated {new Date(item.last_scraped).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {item.latest_price != null ? (
            <span className="text-xl font-bold text-green-400">
              ${item.latest_price.toFixed(2)}
            </span>
          ) : (
            <span className="text-gray-500 text-sm">No price</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <span className="text-gray-500 ml-1">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 p-4">
          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          {loadingHistory ? (
            <p className="text-gray-400 text-sm text-center py-4">Loading history…</p>
          ) : (
            <PriceChart history={history} />
          )}
        </div>
      )}
    </div>
  );
}

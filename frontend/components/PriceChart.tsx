"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PricePoint } from "@/lib/api";

interface PriceChartProps {
  history: PricePoint[];
}

export default function PriceChart({ history }: PriceChartProps) {
  if (history.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">No price history yet.</p>;
  }

  const data = history.map((p) => ({
    date: new Date(p.scraped_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    price: p.price,
  }));

  const prices = history.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.15 || 1;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
        />
        <YAxis
          domain={[minPrice - padding, maxPrice + padding]}
          tickFormatter={(v) => `$${v.toFixed(2)}`}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Price"]}
          contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#d1d5db" }}
          itemStyle={{ color: "#60a5fa" }}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#60a5fa"
          strokeWidth={2}
          dot={{ r: 4, fill: "#60a5fa" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

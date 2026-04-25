"use client";
import { useEffect, useState, useCallback } from "react";

interface Props {
  repoId: string;
  onRangeChange: (from: string | null, to: string | null) => void;
}

interface CommitDate {
  date: string;
  count: number;
}

export default function TimelineScrubber({ repoId, onRangeChange }: Props) {
  const [dates, setDates] = useState<CommitDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [leftPct, setLeftPct] = useState(0);
  const [rightPct, setRightPct] = useState(100);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);

  // Fetch commit dates
  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    fetch(`/api/v1/commits?repoId=${encodeURIComponent(repoId)}&limit=500`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        const items = data.items || [];
        if (items.length === 0) { setLoading(false); return; }

        // First pass: group by date to check how many unique days
        const daySet = new Set<string>();
        for (const c of items) {
          const d = (c.commitDate || "").slice(0, 10);
          if (d) daySet.add(d);
        }

        const bucketMap = new Map<string, number>();

        if (daySet.size < 5) {
          // Few unique days — use 4-hour buckets for better granularity
          for (const c of items) {
            const raw = c.commitDate || "";
            const dt = new Date(raw);
            if (isNaN(dt.getTime())) continue;
            const day = raw.slice(0, 10);
            const bucket = Math.floor(dt.getHours() / 4) * 4;
            const key = `${day}T${String(bucket).padStart(2, "0")}:00`;
            bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
          }

          // Fill in empty 4-hour buckets between min and max so the chart isn't sparse
          const allKeys = Array.from(bucketMap.keys()).sort();
          if (allKeys.length >= 2) {
            const start = new Date(allKeys[0]);
            const end = new Date(allKeys[allKeys.length - 1]);
            const cur = new Date(start);
            while (cur <= end) {
              const day = cur.toISOString().slice(0, 10);
              const h = cur.getHours();
              const key = `${day}T${String(h).padStart(2, "0")}:00`;
              if (!bucketMap.has(key)) bucketMap.set(key, 0);
              cur.setHours(cur.getHours() + 4);
            }
          }
        } else {
          // Many unique days — group by date as before
          for (const c of items) {
            const d = (c.commitDate || "").slice(0, 10);
            if (d) bucketMap.set(d, (bucketMap.get(d) || 0) + 1);
          }
        }

        const sorted = Array.from(bucketMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setDates(sorted);
        setLeftPct(0);
        setRightPct(100);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [repoId]);

  // Compute selected dates from percentages
  const getDateAtPct = useCallback(
    (pct: number): string | null => {
      if (dates.length === 0) return null;
      const idx = Math.round((pct / 100) * (dates.length - 1));
      return dates[Math.max(0, Math.min(idx, dates.length - 1))]?.date || null;
    },
    [dates]
  );

  // Notify parent only when dragging stops
  useEffect(() => {
    if (dragging) return; // Don't fire during drag
    if (dates.length === 0) return;
    const isFullRange = leftPct <= 0 && rightPct >= 100;
    if (isFullRange) {
      onRangeChange(null, null);
    } else {
      onRangeChange(getDateAtPct(leftPct), getDateAtPct(rightPct));
    }
  }, [leftPct, rightPct, dates, getDateAtPct, dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse handlers for slider dragging
  const handleMouseDown = (side: "left" | "right") => {
    setDragging(side);
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      if (dragging === "left") {
        setLeftPct(Math.min(pct, rightPct - 2));
      } else {
        setRightPct(Math.max(pct, leftPct + 2));
      }
    },
    [dragging, leftPct, rightPct]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleReset = () => {
    setLeftPct(0);
    setRightPct(100);
  };

  if (loading || dates.length === 0) return null;

  const fromDate = getDateAtPct(leftPct);
  const toDate = getDateAtPct(rightPct);
  const isFullRange = leftPct <= 0 && rightPct >= 100;
  const maxCount = Math.max(...dates.map((d) => d.count), 1);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Timeline
          </h3>
          <span className="text-xs tabular-nums text-gray-400">
            {fromDate || dates[0]?.date} → {toDate || dates[dates.length - 1]?.date}
          </span>
        </div>
        {!isFullRange && (
          <button
            onClick={handleReset}
            className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:bg-white/[0.1]"
          >
            Reset
          </button>
        )}
      </div>

      {/* Slider bar */}
      <div
        className="relative select-none"
        style={{ height: 48 }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Mini bar chart background */}
        <div className="absolute inset-0 flex items-end gap-px">
          {dates.map((d, i) => {
            const barPct = (i / (dates.length - 1)) * 100;
            const inRange = barPct >= leftPct && barPct <= rightPct;
            return (
              <div
                key={d.date}
                className="flex-1 rounded-t-sm transition-colors"
                style={{
                  height: `${Math.max(4, (d.count / maxCount) * 40)}px`,
                  backgroundColor: inRange
                    ? "rgba(70, 95, 255, 0.4)"
                    : "rgba(156, 163, 175, 0.15)",
                }}
                title={`${d.date}: ${d.count} commit${d.count !== 1 ? "s" : ""}`}
              />
            );
          })}
        </div>

        {/* Track */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />

        {/* Selected range highlight */}
        <div
          className="absolute bottom-0 h-1.5 rounded-full bg-brand-500"
          style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
        />

        {/* Left handle */}
        <div
          className="absolute bottom-0 z-10 -translate-x-1/2 cursor-ew-resize"
          style={{ left: `${leftPct}%` }}
          onMouseDown={() => handleMouseDown("left")}
        >
          <div className="flex h-10 w-5 flex-col items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <div className="h-3 w-0.5 rounded-full bg-gray-400" />
            <div className="mt-0.5 h-3 w-0.5 rounded-full bg-gray-400" />
          </div>
        </div>

        {/* Right handle */}
        <div
          className="absolute bottom-0 z-10 -translate-x-1/2 cursor-ew-resize"
          style={{ left: `${rightPct}%` }}
          onMouseDown={() => handleMouseDown("right")}
        >
          <div className="flex h-10 w-5 flex-col items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <div className="h-3 w-0.5 rounded-full bg-gray-400" />
            <div className="mt-0.5 h-3 w-0.5 rounded-full bg-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

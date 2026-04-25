"use client";
import { useEffect, useState, useCallback, useRef } from "react";

interface Props {
  repoId: string;
  onRangeChange: (from: string | null, to: string | null) => void;
}

interface CommitPoint {
  date: string;
  changes: number;
  message: string;
}

export default function TimelineScrubber({ repoId, onRangeChange }: Props) {
  const [commits, setCommits] = useState<CommitPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [leftPct, setLeftPct] = useState(0);
  const [rightPct, setRightPct] = useState(100);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

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

        const points: CommitPoint[] = items
          .filter((c: Record<string, unknown>) => c.commitDate)
          .map((c: Record<string, unknown>) => {
            let changes = 0;
            const files = c.changedFiles as Array<{ additions?: number; deletions?: number }> | undefined;
            if (files) {
              for (const f of files) {
                changes += (f.additions || 0) + (f.deletions || 0);
              }
            }
            return {
              date: c.commitDate as string,
              changes: Math.max(changes, 1),
              message: ((c.message as string) || "").slice(0, 80),
            };
          })
          .sort((a: CommitPoint, b: CommitPoint) => a.date.localeCompare(b.date));

        setCommits(points);
        setLeftPct(0);
        setRightPct(100);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [repoId]);

  const getDateAtPct = useCallback(
    (pct: number): string | null => {
      if (commits.length === 0) return null;
      const idx = Math.round((pct / 100) * (commits.length - 1));
      return commits[Math.max(0, Math.min(idx, commits.length - 1))]?.date || null;
    },
    [commits]
  );

  useEffect(() => {
    if (dragging) return;
    if (commits.length === 0) return;
    const isFullRange = leftPct <= 0 && rightPct >= 100;
    if (isFullRange) {
      onRangeChange(null, null);
    } else {
      onRangeChange(getDateAtPct(leftPct), getDateAtPct(rightPct));
    }
  }, [leftPct, rightPct, commits, getDateAtPct, dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = (side: "left" | "right") => setDragging(side);

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

  const handleMouseUp = useCallback(() => setDragging(null), []);

  const handleReset = () => { setLeftPct(0); setRightPct(100); };

  if (loading || commits.length === 0) return null;

  const fromDate = getDateAtPct(leftPct);
  const toDate = getDateAtPct(rightPct);
  const isFullRange = leftPct <= 0 && rightPct >= 100;
  const maxChanges = Math.max(...commits.map((c) => c.changes), 1);

  // Build SVG sparkline path
  const sparkH = 40;
  const n = commits.length;
  const points = commits.map((c, i) => {
    const x = n === 1 ? 50 : (i / (n - 1)) * 100;
    const y = sparkH - (c.changes / maxChanges) * (sparkH - 4);
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${sparkH} L ${points[0].x} ${sparkH} Z`;

  // Selected range area clip
  const selPoints = points.filter((p) => p.x >= leftPct && p.x <= rightPct);
  // Add boundary interpolation points
  const interpY = (pct: number) => {
    if (n <= 1) return points[0]?.y || 0;
    const fIdx = (pct / 100) * (n - 1);
    const lo = Math.floor(fIdx);
    const hi = Math.min(lo + 1, n - 1);
    const t = fIdx - lo;
    return points[lo].y * (1 - t) + points[hi].y * t;
  };
  const leftY = interpY(leftPct);
  const rightY = interpY(rightPct);
  const selPath = [
    `M ${leftPct} ${leftY}`,
    ...selPoints.map((p) => `L ${p.x} ${p.y}`),
    `L ${rightPct} ${rightY}`,
    `L ${rightPct} ${sparkH}`,
    `L ${leftPct} ${sparkH} Z`,
  ].join(" ");
  const selLine = [
    `M ${leftPct} ${leftY}`,
    ...selPoints.map((p) => `L ${p.x} ${p.y}`),
    `L ${rightPct} ${rightY}`,
  ].join(" ");

  const selectedCount = commits.filter((_, i) => {
    const x = n === 1 ? 50 : (i / (n - 1)) * 100;
    return x >= leftPct && x <= rightPct;
  }).length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Timeline
          </h3>
          <span className="text-xs tabular-nums text-gray-400">
            {(fromDate || commits[0]?.date || "").slice(0, 10)} → {(toDate || commits[commits.length - 1]?.date || "").slice(0, 10)}
          </span>
          <span className="text-[10px] text-gray-400">
            {isFullRange ? `${n} commits` : `${selectedCount} of ${n} commits`}
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

      <div
        ref={trackRef}
        className="relative select-none"
        style={{ height: sparkH + 8 }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Sparkline SVG */}
        <svg
          viewBox={`0 0 100 ${sparkH}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          style={{ height: sparkH }}
        >
          {/* Full area (dimmed) */}
          <path d={areaPath} fill="rgba(156, 163, 175, 0.1)" />
          <path d={linePath} fill="none" stroke="rgba(156, 163, 175, 0.3)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />

          {/* Selected range area */}
          <path d={selPath} fill="rgba(70, 95, 255, 0.15)" />
          <path d={selLine} fill="none" stroke="rgba(70, 95, 255, 0.8)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />

          {/* Dots for each commit in range */}
          {points.map((p, i) => {
            const inRange = p.x >= leftPct && p.x <= rightPct;
            return inRange ? (
              <circle key={i} cx={p.x} cy={p.y} r="0.8" fill="rgba(70, 95, 255, 0.9)" vectorEffect="non-scaling-stroke">
                <title>{commits[i].date.slice(0, 16).replace("T", " ")}: {commits[i].changes} lines — {commits[i].message}</title>
              </circle>
            ) : null;
          })}
        </svg>

        {/* Track line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div
          className="absolute bottom-0 h-1 rounded-full bg-brand-500"
          style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
        />

        {/* Left handle */}
        <div
          className="absolute bottom-0 z-10 -translate-x-1/2 cursor-ew-resize"
          style={{ left: `${leftPct}%` }}
          onMouseDown={() => handleMouseDown("left")}
        >
          <div className="flex h-10 w-4 flex-col items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <div className="h-3 w-px rounded-full bg-gray-400" />
          </div>
        </div>

        {/* Right handle */}
        <div
          className="absolute bottom-0 z-10 -translate-x-1/2 cursor-ew-resize"
          style={{ left: `${rightPct}%` }}
          onMouseDown={() => handleMouseDown("right")}
        >
          <div className="flex h-10 w-4 flex-col items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <div className="h-3 w-px rounded-full bg-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

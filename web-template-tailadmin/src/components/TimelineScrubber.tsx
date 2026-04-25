"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface Bucket {
  period: string;
  additions: number;
  deletions: number;
  modifications: number;
}

interface Props {
  repoId: string;
  onRangeChange: (from: string | null, to: string | null) => void;
}

export default function TimelineScrubber({ repoId, onRangeChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Range state as indices into the buckets array
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(0);
  const dragging = useRef<"left" | "right" | null>(null);

  // Fetch timeline data
  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/timeline?repoId=${encodeURIComponent(repoId)}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch timeline");
        return r.json();
      })
      .then((d: { buckets: Bucket[] }) => {
        setBuckets(d.buckets || []);
        setLeftIdx(0);
        setRightIdx(Math.max(0, (d.buckets || []).length - 1));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [repoId]);

  // Notify parent when range changes
  useEffect(() => {
    if (buckets.length === 0) return;
    const isFullRange = leftIdx === 0 && rightIdx === buckets.length - 1;
    onRangeChange(
      isFullRange ? null : buckets[leftIdx].period,
      isFullRange ? null : buckets[rightIdx].period,
    );
  }, [leftIdx, rightIdx, buckets]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectAll = () => {
    setLeftIdx(0);
    setRightIdx(Math.max(0, buckets.length - 1));
  };

  // Chart dimensions
  const MARGIN = { top: 4, right: 12, bottom: 18, left: 12 };
  const CHART_HEIGHT = 80;

  const renderChart = useCallback(() => {
    if (!svgRef.current || !containerRef.current || buckets.length === 0) return;

    const width = containerRef.current.clientWidth || 600;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

    const keys = ["additions", "deletions", "modifications"] as const;
    const colors = { additions: "#22c55e", deletions: "#ef4444", modifications: "#3b82f6" };

    const parseDate = (s: string) => new Date(s);
    const dates = buckets.map((b) => parseDate(b.period));

    const xScale = d3
      .scaleTime()
      .domain([d3.min(dates) as Date, d3.max(dates) as Date])
      .range([0, innerW]);

    const stackData = buckets.map((b) => ({
      date: parseDate(b.period),
      additions: b.additions,
      deletions: b.deletions,
      modifications: b.modifications,
    }));

    const stack = d3
      .stack<(typeof stackData)[0]>()
      .keys(keys)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const series = stack(stackData);
    const maxY = d3.max(series, (s) => d3.max(s, (d) => d[1])) || 1;
    const yScale = d3.scaleLinear().domain([0, maxY]).range([innerH, 0]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", CHART_HEIGHT);

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Stacked area
    const area = d3
      .area<d3.SeriesPoint<(typeof stackData)[0]>>()
      .x((d) => xScale(d.data.date))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    series.forEach((s) => {
      const key = s.key as keyof typeof colors;
      g.append("path")
        .datum(s)
        .attr("fill", colors[key])
        .attr("opacity", 0.7)
        .attr("d", area as never);
    });

    // Dim overlays (outside selected range)
    const lx = xScale(dates[leftIdx]);
    const rx = xScale(dates[rightIdx]);

    // Left dim
    if (lx > 0) {
      g.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", lx)
        .attr("height", innerH)
        .attr("fill", "#000")
        .attr("opacity", 0.35);
    }
    // Right dim
    if (rx < innerW) {
      g.append("rect")
        .attr("x", rx)
        .attr("y", 0)
        .attr("width", innerW - rx)
        .attr("height", innerH)
        .attr("fill", "#000")
        .attr("opacity", 0.35);
    }

    // Handle bars
    const handleWidth = 6;
    const drawHandle = (x: number, id: string) => {
      const handle = g.append("g").attr("class", `handle-${id}`);
      handle
        .append("rect")
        .attr("x", x - handleWidth / 2)
        .attr("y", 0)
        .attr("width", handleWidth)
        .attr("height", innerH)
        .attr("fill", "#a78bfa")
        .attr("rx", 2)
        .attr("opacity", 0.9)
        .style("cursor", "ew-resize");
      // Grip dots
      for (let dy = innerH * 0.3; dy <= innerH * 0.7; dy += 6) {
        handle
          .append("circle")
          .attr("cx", x)
          .attr("cy", dy)
          .attr("r", 1)
          .attr("fill", "#fff")
          .attr("opacity", 0.8);
      }
    };
    drawHandle(lx, "left");
    drawHandle(rx, "right");

    // Minimal x-axis
    const tickCount = Math.min(buckets.length, 6);
    const xAxis = d3.axisBottom(xScale).ticks(tickCount).tickFormat(d3.timeFormat("%b %y") as never);
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis)
      .call((sel) => sel.select(".domain").remove())
      .call((sel) =>
        sel
          .selectAll("text")
          .attr("font-size", "9px")
          .attr("fill", "#9ca3af"),
      )
      .call((sel) => sel.selectAll("line").attr("stroke", "#4b5563"));
  }, [buckets, leftIdx, rightIdx, MARGIN.left, MARGIN.right, MARGIN.top, MARGIN.bottom]);

  useEffect(() => {
    renderChart();
  }, [renderChart]);

  useEffect(() => {
    const handleResize = () => renderChart();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderChart]);

  // Mouse interaction for dragging handles
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (buckets.length === 0 || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const mouseX = e.clientX - svgRect.left - MARGIN.left;

      const width = containerRef.current.clientWidth || 600;
      const innerW = width - MARGIN.left - MARGIN.right;
      const dates = buckets.map((b) => new Date(b.period));
      const xScale = d3
        .scaleTime()
        .domain([d3.min(dates) as Date, d3.max(dates) as Date])
        .range([0, innerW]);

      const lx = xScale(dates[leftIdx]);
      const rx = xScale(dates[rightIdx]);

      const distLeft = Math.abs(mouseX - lx);
      const distRight = Math.abs(mouseX - rx);

      if (distLeft < 20 && distLeft <= distRight) {
        dragging.current = "left";
      } else if (distRight < 20) {
        dragging.current = "right";
      }
    },
    [buckets, leftIdx, rightIdx, MARGIN.left, MARGIN.right],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging.current || buckets.length === 0 || !svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - svgRect.left - MARGIN.left;

      const width = (containerRef.current?.clientWidth || 600);
      const innerW = width - MARGIN.left - MARGIN.right;
      const dates = buckets.map((b) => new Date(b.period));
      const xScale = d3
        .scaleTime()
        .domain([d3.min(dates) as Date, d3.max(dates) as Date])
        .range([0, innerW]);

      // Find closest bucket index
      const targetDate = xScale.invert(Math.max(0, Math.min(mouseX, innerW)));
      let closest = 0;
      let minDist = Infinity;
      for (let i = 0; i < dates.length; i++) {
        const dist = Math.abs(dates[i].getTime() - targetDate.getTime());
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }

      if (dragging.current === "left") {
        setLeftIdx(Math.min(closest, rightIdx));
      } else {
        setRightIdx(Math.max(closest, leftIdx));
      }
    },
    [buckets, leftIdx, rightIdx, MARGIN.left, MARGIN.right],
  );

  const handleMouseUp = useCallback(() => {
    dragging.current = null;
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-xs text-gray-400">Loading timeline…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-xs text-red-400">{error}</p>
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-xs text-gray-400">No timeline data</p>
      </div>
    );
  }

  const fromLabel = buckets[leftIdx]?.period ?? "";
  const toLabel = buckets[rightIdx]?.period ?? "";
  const isFullRange = leftIdx === 0 && rightIdx === buckets.length - 1;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Timeline Scrubber
          </h3>
          <div className="flex gap-2 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-green-500" />
              Add
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-red-500" />
              Del
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-blue-500" />
              Mod
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
            {fromLabel} — {toLabel}
          </span>
          {!isFullRange && (
            <button
              onClick={handleSelectAll}
              className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 transition hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:bg-white/[0.1]"
            >
              Select All
            </button>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div
        ref={containerRef}
        className="cursor-default select-none px-2 pb-2"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg ref={svgRef} className="w-full" />
      </div>
    </div>
  );
}

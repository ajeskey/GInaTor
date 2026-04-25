"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface ActivityMatrixData {
  matrix: number[][];
  totalCommits: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ActivityMatrix({ repoId }: { repoId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ActivityMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/activity-matrix?repoId=${encodeURIComponent(repoId)}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    if (data.totalCommits === 0) return;

    const cellSize = 28;
    const margin = { top: 40, right: 20, bottom: 20, left: 50 };
    const width = margin.left + 24 * cellSize + margin.right;
    const height = margin.top + 7 * cellSize + margin.bottom;

    const maxVal = Math.max(...data.matrix.flat(), 1);
    const colorScale = d3.scaleSequential(d3.interpolateGreens).domain([0, maxVal]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const tooltip = d3.select(tooltipRef.current);

    // Hour labels
    g.selectAll(".hour-label")
      .data(d3.range(24))
      .join("text")
      .attr("x", (d) => d * cellSize + cellSize / 2)
      .attr("y", -8)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#9ca3af")
      .text((d) => d.toString());

    // Day labels
    g.selectAll(".day-label")
      .data(DAYS)
      .join("text")
      .attr("x", -8)
      .attr("y", (_, i) => i * cellSize + cellSize / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#6b7280")
      .text((d) => d);

    // Cells
    const cells: { day: number; hour: number; count: number }[] = [];
    data.matrix.forEach((row, di) => {
      row.forEach((val, hi) => {
        cells.push({ day: di, hour: hi, count: val });
      });
    });

    g.selectAll(".cell")
      .data(cells)
      .join("rect")
      .attr("x", (d) => d.hour * cellSize)
      .attr("y", (d) => d.day * cellSize)
      .attr("width", cellSize - 2)
      .attr("height", cellSize - 2)
      .attr("rx", 4)
      .attr("fill", (d) => d.count === 0 ? "#f3f4f6" : colorScale(d.count))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", "1")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 28}px`)
          .html(`<strong>${DAYS[d.day]} ${d.hour}:00</strong><br/>${d.count} commits`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
      })
      .on("mouseout", () => { tooltip.style("opacity", "0"); });
  }, [data]);

  useEffect(() => { renderChart(); }, [renderChart]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.totalCommits === 0) return <p className="text-sm text-gray-400">No data available</p>;

  return (
    <div ref={containerRef} className="relative overflow-auto">
      <p className="mb-3 text-xs text-gray-500">Day × Hour activity matrix · {data.totalCommits} total commits</p>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

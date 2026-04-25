"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface HeatmapCell {
  author: string;
  timePeriod: string;
  count: number;
}

interface HeatmapData {
  grid: HeatmapCell[];
  totalCommits: number;
}

export default function Heatmap({ repoId }: { repoId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/heatmap?repoId=${encodeURIComponent(repoId)}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    const { grid } = data;
    if (grid.length === 0) return;

    const authors = [...new Set(grid.map((g) => g.author))].sort();
    const periods = [...new Set(grid.map((g) => g.timePeriod))].sort();
    const lookup = new Map(grid.map((g) => [`${g.author}|${g.timePeriod}`, g.count]));
    const maxCount = Math.max(...grid.map((g) => g.count), 1);

    const margin = { top: 60, right: 20, bottom: 20, left: 140 };
    const cellSize = 16;
    const width = margin.left + periods.length * cellSize + margin.right;
    const height = margin.top + authors.length * cellSize + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const colorScale = d3.scaleSequential(d3.interpolateGreens).domain([0, maxCount]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Author labels
    g.selectAll(".author-label")
      .data(authors)
      .join("text")
      .attr("class", "author-label")
      .attr("x", -6)
      .attr("y", (_, i) => i * cellSize + cellSize / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#6b7280")
      .text((d) => d.length > 18 ? d.slice(0, 16) + "…" : d);

    // Period labels (rotated)
    g.selectAll(".period-label")
      .data(periods)
      .join("text")
      .attr("class", "period-label")
      .attr("x", (_, i) => i * cellSize + cellSize / 2)
      .attr("y", -6)
      .attr("text-anchor", "start")
      .attr("font-size", "9px")
      .attr("fill", "#9ca3af")
      .attr("transform", (_, i) => `rotate(-45, ${i * cellSize + cellSize / 2}, -6)`)
      .text((d) => d);

    // Cells
    const cells: { author: string; period: string; count: number; ai: number; pi: number }[] = [];
    authors.forEach((author, ai) => {
      periods.forEach((period, pi) => {
        cells.push({ author, period, count: lookup.get(`${author}|${period}`) || 0, ai, pi });
      });
    });

    const tooltip = d3.select(tooltipRef.current);

    g.selectAll(".cell")
      .data(cells)
      .join("rect")
      .attr("class", "cell")
      .attr("x", (d) => d.pi * cellSize)
      .attr("y", (d) => d.ai * cellSize)
      .attr("width", cellSize - 1)
      .attr("height", cellSize - 1)
      .attr("rx", 2)
      .attr("fill", (d) => d.count === 0 ? "#f3f4f6" : colorScale(d.count))
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", "1")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 28}px`)
          .html(`<strong>${d.author}</strong><br/>${d.period}<br/>${d.count} commits`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
      })
      .on("mouseout", () => { tooltip.style("opacity", "0"); });
  }, [data]);

  useEffect(() => { renderChart(); }, [renderChart]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.grid.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  return (
    <div ref={containerRef} className="relative overflow-auto">
      <p className="mb-3 text-xs text-gray-500">Contributor activity heatmap · {data.totalCommits} total commits</p>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

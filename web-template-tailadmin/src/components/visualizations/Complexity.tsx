"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface ComplexityFile {
  path?: string;
  size?: number;
  lines?: number;
  complexity?: number;
  additions?: number;
}

export default function Complexity({ repoId, from, to }: { repoId: string; from?: string; to?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ComplexityFile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/complexity?repoId=${encodeURIComponent(repoId)}${from ? `&from=${encodeURIComponent(from)}` : ""}${to ? `&to=${encodeURIComponent(to)}` : ""}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(Array.isArray(d) ? d : d.files || []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId, from, to]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    if (data.length === 0) return;

    const sorted = [...data]
      .map((f, i) => ({ ...f, idx: i, metric: f.size || f.lines || f.complexity || 0 }))
      .sort((a, b) => b.metric - a.metric)
      .slice(0, 60);

    const width = containerRef.current.clientWidth || 800;
    const height = 380;
    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const xScale = d3.scalePoint<number>()
      .domain(sorted.map((_, i) => i))
      .range([0, innerW]);

    const maxMetric = d3.max(sorted, (d) => d.metric) || 1;
    const yScale = d3.scaleLinear().domain([0, maxMetric]).nice().range([innerH, 0]);

    // Threshold at 75th percentile
    const metrics = sorted.map((d) => d.metric).sort((a, b) => a - b);
    const threshold = metrics[Math.floor(metrics.length * 0.75)] || maxMetric * 0.75;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const tooltip = d3.select(tooltipRef.current);

    // Grid
    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(() => ""))
      .call((sel) => sel.selectAll("line").attr("stroke", "#e5e7eb").attr("stroke-dasharray", "2,2"))
      .call((sel) => sel.select(".domain").remove());

    // Area
    const area = d3.area<(typeof sorted)[0]>()
      .x((_, i) => xScale(i) || 0)
      .y0(innerH)
      .y1((d) => yScale(d.metric))
      .curve(d3.curveMonotoneX);

    g.append("path").datum(sorted).attr("fill", "rgba(139, 92, 246, 0.12)").attr("d", area);

    // Line
    const line = d3.line<(typeof sorted)[0]>()
      .x((_, i) => xScale(i) || 0)
      .y((d) => yScale(d.metric))
      .curve(d3.curveMonotoneX);

    g.append("path").datum(sorted).attr("fill", "none").attr("stroke", "#8b5cf6").attr("stroke-width", 2.5).attr("d", line);

    // Threshold line
    g.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yScale(threshold)).attr("y2", yScale(threshold))
      .attr("stroke", "#f59e0b").attr("stroke-width", 1.5).attr("stroke-dasharray", "6,3");
    g.append("text")
      .attr("x", innerW - 4).attr("y", yScale(threshold) - 6)
      .attr("text-anchor", "end").attr("font-size", "9px").attr("fill", "#f59e0b")
      .text("75th percentile threshold");

    // Dots
    g.selectAll(".dot")
      .data(sorted)
      .join("circle")
      .attr("cx", (_, i) => xScale(i) || 0)
      .attr("cy", (d) => yScale(d.metric))
      .attr("r", (d) => d.metric > threshold ? 5 : 3)
      .attr("fill", (d) => d.metric > threshold ? "#ef4444" : "#8b5cf6")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", "1")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 28}px`)
          .html(`<strong>${d.path}</strong><br/>Size: ${d.size ?? "—"}<br/>Lines: ${d.lines ?? "—"}<br/>Complexity: ${d.complexity ?? "—"}`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
      })
      .on("mouseout", () => { tooltip.style("opacity", "0"); });

    // Axes
    const yAxis = g.append("g").call(d3.axisLeft(yScale).ticks(6));
    yAxis.select(".domain").attr("stroke", "#d1d5db");
    yAxis.selectAll("text").attr("font-size", "10px").attr("fill", "#6b7280");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -45)
      .attr("text-anchor", "middle").attr("font-size", "11px").attr("fill", "#9ca3af")
      .text("Size / Complexity");
  }, [data]);

  useEffect(() => { renderChart(); }, [renderChart]);
  useEffect(() => {
    const handleResize = () => renderChart();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderChart]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <p className="mb-3 text-xs text-gray-500">Code complexity trend — files ranked by size/complexity, threshold at 75th percentile</p>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

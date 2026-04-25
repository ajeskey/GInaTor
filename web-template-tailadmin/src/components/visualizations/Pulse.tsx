"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface PulseEntry {
  period: string;
  count: number;
}

export default function Pulse({ repoId, from, to }: { repoId: string; from?: string; to?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PulseEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    let url = `/api/v1/pulse?repoId=${encodeURIComponent(repoId)}`;
    if (from) url += `&from=${encodeURIComponent(from)}`;
    if (to) url += `&to=${encodeURIComponent(to)}`;
    fetch(url, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId, from, to]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    if (data.length === 0) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 350;
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // Spike detection: mean + 2σ
    const mean = d3.mean(data, (d) => d.count) || 0;
    const std = Math.sqrt(d3.mean(data, (d) => (d.count - mean) ** 2) || 0);
    const spikeThreshold = mean + 2 * std;

    const xScale = d3.scalePoint<string>()
      .domain(data.map((d) => d.period))
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) || 1])
      .nice()
      .range([innerH, 0]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(() => ""))
      .call((sel) => sel.selectAll("line").attr("stroke", "#e5e7eb").attr("stroke-dasharray", "2,2"))
      .call((sel) => sel.select(".domain").remove());

    // Area
    const area = d3.area<PulseEntry>()
      .x((d) => xScale(d.period) || 0)
      .y0(innerH)
      .y1((d) => yScale(d.count))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("fill", "rgba(59, 130, 246, 0.15)")
      .attr("d", area);

    // Line
    const line = d3.line<PulseEntry>()
      .x((d) => xScale(d.period) || 0)
      .y((d) => yScale(d.count))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2.5)
      .attr("d", line);

    // Spike threshold line
    if (spikeThreshold > 0 && spikeThreshold < (d3.max(data, (d) => d.count) || 0)) {
      g.append("line")
        .attr("x1", 0).attr("x2", innerW)
        .attr("y1", yScale(spikeThreshold)).attr("y2", yScale(spikeThreshold))
        .attr("stroke", "#ef4444").attr("stroke-width", 1).attr("stroke-dasharray", "4,4").attr("opacity", 0.6);
      g.append("text")
        .attr("x", innerW - 4).attr("y", yScale(spikeThreshold) - 4)
        .attr("text-anchor", "end").attr("font-size", "9px").attr("fill", "#ef4444")
        .text("2σ spike threshold");
    }

    const tooltip = d3.select(tooltipRef.current);

    // Data points
    g.selectAll(".dot")
      .data(data)
      .join("circle")
      .attr("class", "dot")
      .attr("cx", (d) => xScale(d.period) || 0)
      .attr("cy", (d) => yScale(d.count))
      .attr("r", (d) => d.count > spikeThreshold ? 5 : 3)
      .attr("fill", (d) => d.count > spikeThreshold ? "#ef4444" : "#3b82f6")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        const isSpike = d.count > spikeThreshold;
        tooltip.style("opacity", "1")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 28}px`)
          .html(`<strong>${d.period}</strong><br/>${d.count} commits${isSpike ? '<br/><span style="color:#ef4444">⚡ Spike detected</span>' : ""}`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
      })
      .on("mouseout", () => { tooltip.style("opacity", "0"); });

    // Axes
    const xAxis = g.append("g").attr("transform", `translate(0,${innerH})`).call(
      d3.axisBottom(xScale).tickValues(
        data.length > 20 ? data.filter((_, i) => i % Math.ceil(data.length / 15) === 0).map((d) => d.period) : data.map((d) => d.period)
      )
    );
    xAxis.selectAll("text").attr("transform", "rotate(-40)").attr("text-anchor", "end").attr("font-size", "9px");
    xAxis.select(".domain").attr("stroke", "#d1d5db");

    const yAxis = g.append("g").call(d3.axisLeft(yScale).ticks(6));
    yAxis.select(".domain").attr("stroke", "#d1d5db");
    yAxis.selectAll("text").attr("font-size", "10px").attr("fill", "#6b7280");
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
      <p className="mb-3 text-xs text-gray-500">Commit pulse — spikes (&gt;2σ) highlighted in red</p>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

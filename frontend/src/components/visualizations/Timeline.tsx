"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface TimelineBucket {
  period: string;
  additions: number;
  deletions: number;
  modifications: number;
}

export default function Timeline({ repoId, from, to }: { repoId: string; from?: string; to?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ buckets: TimelineBucket[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    let url = `/api/v1/timeline?repoId=${encodeURIComponent(repoId)}`;
    if (from) url += `&from=${encodeURIComponent(from)}`;
    if (to) url += `&to=${encodeURIComponent(to)}`;
    fetch(url, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId, from, to]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    const { buckets } = data;
    if (buckets.length === 0) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const keys = ["additions", "deletions", "modifications"] as const;
    const colors = { additions: "#22c55e", deletions: "#ef4444", modifications: "#3b82f6" };

    const stackData = buckets.map((b) => ({
      period: b.period,
      additions: b.additions,
      deletions: b.deletions,
      modifications: b.modifications,
    }));

    const stack = d3.stack<(typeof stackData)[0]>()
      .keys(keys)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const series = stack(stackData);

    const xScale = d3.scaleBand()
      .domain(buckets.map((b) => b.period))
      .range([0, innerW])
      .padding(0.15);

    const maxY = d3.max(series, (s) => d3.max(s, (d) => d[1])) || 1;
    const yScale = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0]);

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

    // Stacked bars
    series.forEach((s) => {
      const key = s.key as keyof typeof colors;
      g.selectAll(`.bar-${key}`)
        .data(s)
        .join("rect")
        .attr("x", (d) => xScale(d.data.period) || 0)
        .attr("y", (d) => yScale(d[1]))
        .attr("width", xScale.bandwidth())
        .attr("height", (d) => Math.max(0, yScale(d[0]) - yScale(d[1])))
        .attr("fill", colors[key])
        .attr("opacity", 0.85)
        .attr("rx", 1)
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
          const b = d.data;
          tooltip.style("opacity", "1")
            .style("left", `${event.offsetX + 12}px`)
            .style("top", `${event.offsetY - 28}px`)
            .html(`<strong>${b.period}</strong><br/><span style="color:#22c55e">+${b.additions}</span> <span style="color:#ef4444">-${b.deletions}</span> <span style="color:#3b82f6">~${b.modifications}</span>`);
        })
        .on("mousemove", (event) => {
          tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
        })
        .on("mouseout", () => { tooltip.style("opacity", "0"); });
    });

    // X axis
    const xAxis = g.append("g").attr("transform", `translate(0,${innerH})`).call(
      d3.axisBottom(xScale).tickValues(
        buckets.length > 20
          ? buckets.filter((_, i) => i % Math.ceil(buckets.length / 15) === 0).map((b) => b.period)
          : buckets.map((b) => b.period)
      )
    );
    xAxis.selectAll("text").attr("transform", "rotate(-40)").attr("text-anchor", "end").attr("font-size", "9px");
    xAxis.select(".domain").attr("stroke", "#d1d5db");

    // Y axis
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
  if (!data || data.buckets.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <div className="mb-3 flex items-center gap-4">
        <p className="text-xs text-gray-500">{data.buckets.length} periods</p>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-500" /> Additions</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-500" /> Deletions</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-blue-500" /> Modifications</span>
        </div>
      </div>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

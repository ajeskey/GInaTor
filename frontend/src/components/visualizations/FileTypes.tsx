"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface FileTypeEntry {
  extension: string;
  count: number;
}

interface FileTypesData {
  types: FileTypeEntry[];
}

export default function FileTypes({ repoId, from, to }: { repoId: string; from?: string; to?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<FileTypesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/filetypes?repoId=${encodeURIComponent(repoId)}${from ? `&from=${encodeURIComponent(from)}` : ""}${to ? `&to=${encodeURIComponent(to)}` : ""}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId, from, to]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    const types = data.types;
    if (types.length === 0) return;

    const sorted = [...types].sort((a, b) => b.count - a.count).slice(0, 20);
    const total = sorted.reduce((s, t) => s + t.count, 0);

    const containerWidth = containerRef.current.clientWidth || 700;
    const size = Math.min(containerWidth, 500);
    const radius = size / 2;
    const innerRadius = radius * 0.55;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", containerWidth).attr("height", size);

    const g = svg.append("g").attr("transform", `translate(${size / 2},${size / 2})`);
    const tooltip = d3.select(tooltipRef.current);
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    const pie = d3.pie<FileTypeEntry>().value((d) => d.count).sort(null).padAngle(0.02);
    const arc = d3.arc<d3.PieArcDatum<FileTypeEntry>>().innerRadius(innerRadius).outerRadius(radius - 4);
    const arcHover = d3.arc<d3.PieArcDatum<FileTypeEntry>>().innerRadius(innerRadius).outerRadius(radius);

    const arcs = g.selectAll("path")
      .data(pie(sorted))
      .join("path")
      .attr("d", arc)
      .attr("fill", (_, i) => colorScale(String(i)))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).transition().duration(150).attr("d", arcHover);
        const pct = ((d.data.count / total) * 100).toFixed(1);
        tooltip.style("opacity", "1")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 28}px`)
          .html(`<strong>${d.data.extension}</strong><br/>${d.data.count} changes (${pct}%)`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
      })
      .on("mouseout", function () {
        d3.select(this).transition().duration(150).attr("d", arc);
        tooltip.style("opacity", "0");
      });

    // Center text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("font-size", "24px")
      .attr("font-weight", "bold")
      .attr("fill", "#374151")
      .text(total);
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .attr("font-size", "11px")
      .attr("fill", "#9ca3af")
      .text("total changes");

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${size + 20}, 20)`);
    sorted.forEach((t, i) => {
      const row = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
      row.append("rect").attr("width", 14).attr("height", 14).attr("rx", 3).attr("fill", colorScale(String(i)));
      row.append("text").attr("x", 20).attr("y", 11).attr("font-size", "11px").attr("fill", "#6b7280")
        .text(`${t.extension} (${t.count})`);
    });
  }, [data]);

  useEffect(() => { renderChart(); }, [renderChart]);
  useEffect(() => {
    const handleResize = () => renderChart();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderChart]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.types.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <p className="mb-3 text-xs text-gray-500">File type distribution — donut chart by change count</p>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

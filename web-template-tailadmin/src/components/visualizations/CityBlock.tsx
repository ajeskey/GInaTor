"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface Building {
  path: string;
  height: number;
  footprint: number;
}

export default function CityBlock({ repoId }: { repoId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ buildings: Building[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/city-block?repoId=${encodeURIComponent(repoId)}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    const buildings = data.buildings;
    if (buildings.length === 0) return;

    // Group by directory
    const dirMap = new Map<string, Building[]>();
    buildings.forEach((b) => {
      const parts = b.path.split("/");
      const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      dirMap.get(dir)!.push(b);
    });

    const dirs = [...dirMap.entries()].sort((a, b) => {
      const sumA = a[1].reduce((s, x) => s + x.height, 0);
      const sumB = b[1].reduce((s, x) => s + x.height, 0);
      return sumB - sumA;
    }).slice(0, 12);

    const allBuildings = dirs.flatMap(([dir, files]) =>
      files.sort((a, b) => b.height - a.height).slice(0, 15).map((f) => ({ ...f, dir }))
    );

    const width = containerRef.current.clientWidth || 800;
    const height = 450;
    const margin = { top: 20, right: 20, bottom: 80, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const maxHeight = d3.max(allBuildings, (b) => b.height) || 1;
    const maxFootprint = d3.max(allBuildings, (b) => b.footprint) || 1;

    const yScale = d3.scaleLinear().domain([0, maxHeight]).nice().range([innerH, 0]);
    const widthScale = d3.scaleLinear().domain([0, maxFootprint]).range([6, 28]);
    const dirColorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(dirs.map(([d]) => d));

    // Compute x positions
    let xPos = 0;
    const positioned = allBuildings.map((b) => {
      const w = widthScale(b.footprint);
      const item = { ...b, x: xPos, w };
      xPos += w + 3;
      return item;
    });

    const totalWidth = xPos;
    const svgWidth = Math.max(width, totalWidth + margin.left + margin.right);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", svgWidth).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const tooltip = d3.select(tooltipRef.current);

    // Ground line
    g.append("line")
      .attr("x1", 0).attr("x2", totalWidth)
      .attr("y1", innerH).attr("y2", innerH)
      .attr("stroke", "#9ca3af").attr("stroke-width", 2);

    // Grid
    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(-totalWidth).tickFormat(() => ""))
      .call((sel) => sel.selectAll("line").attr("stroke", "#f3f4f6").attr("stroke-dasharray", "2,2"))
      .call((sel) => sel.select(".domain").remove());

    // Buildings
    g.selectAll(".building")
      .data(positioned)
      .join("rect")
      .attr("x", (d) => d.x)
      .attr("y", (d) => yScale(d.height))
      .attr("width", (d) => d.w)
      .attr("height", (d) => innerH - yScale(d.height))
      .attr("fill", (d) => dirColorScale(d.dir))
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .attr("rx", 1)
      .attr("opacity", 0.85)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", "1")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 28}px`)
          .html(`<strong>${d.path}</strong><br/>Height (lines): ${d.height}<br/>Width (frequency): ${d.footprint}<br/>Dir: ${d.dir}`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
      })
      .on("mouseout", () => { tooltip.style("opacity", "0"); });

    // Rooftop windows effect
    positioned.forEach((b) => {
      const bHeight = innerH - yScale(b.height);
      if (bHeight > 20 && b.w > 10) {
        const windowRows = Math.min(Math.floor(bHeight / 8), 6);
        for (let r = 0; r < windowRows; r++) {
          g.append("rect")
            .attr("x", b.x + b.w * 0.25)
            .attr("y", yScale(b.height) + 4 + r * 8)
            .attr("width", b.w * 0.5)
            .attr("height", 3)
            .attr("fill", "rgba(255,255,255,0.3)")
            .attr("rx", 0.5)
            .attr("pointer-events", "none");
        }
      }
    });

    // Y axis
    const yAxis = g.append("g").call(d3.axisLeft(yScale).ticks(6));
    yAxis.select(".domain").attr("stroke", "#d1d5db");
    yAxis.selectAll("text").attr("font-size", "10px").attr("fill", "#6b7280");
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -45)
      .attr("text-anchor", "middle").attr("font-size", "11px").attr("fill", "#9ca3af")
      .text("Lines (height)");

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${margin.left}, ${height - 20})`);
    dirs.slice(0, 8).forEach(([dir], i) => {
      const xOff = i * 100;
      legend.append("rect").attr("x", xOff).attr("y", 0).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", dirColorScale(dir));
      legend.append("text").attr("x", xOff + 14).attr("y", 9).attr("font-size", "9px").attr("fill", "#6b7280")
        .text(dir.length > 12 ? dir.slice(0, 10) + "…" : dir);
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
  if (!data || data.buildings.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  return (
    <div ref={containerRef} className="relative overflow-auto">
      <p className="mb-3 text-xs text-gray-500">City block — files as buildings. Height = lines, width = change frequency. Grouped by directory.</p>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

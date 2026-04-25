"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface TreemapFile {
  path: string;
  frequency: number;
}

interface TreemapData {
  files: TreemapFile[];
}

export default function Treemap({ repoId }: { repoId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<TreemapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/treemap?repoId=${encodeURIComponent(repoId)}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    const files = data.files;
    if (files.length === 0) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 500;

    // Build hierarchy from file paths
    const root: { name: string; children: Record<string, unknown>[] } = { name: "root", children: [] };
    const map = new Map<string, { name: string; children: unknown[]; value?: number }>();
    map.set("root", root as never);

    files.forEach((f) => {
      const parts = f.path.split("/");
      let currentPath = "root";
      let parent = root;
      parts.forEach((part, i) => {
        const newPath = currentPath + "/" + part;
        if (!map.has(newPath)) {
          const node: { name: string; children: unknown[]; value?: number } = { name: part, children: [] };
          if (i === parts.length - 1) {
            node.value = f.frequency;
          }
          map.set(newPath, node);
          (parent.children as unknown[]).push(node);
        }
        parent = map.get(newPath) as typeof parent;
        currentPath = newPath;
      });
    });

    const hierarchy = d3.hierarchy(root)
      .sum((d: unknown) => (d as { value?: number }).value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemapLayout = d3.treemap<typeof root>()
      .size([width, height])
      .padding(2)
      .round(true);

    treemapLayout(hierarchy);

    const maxFreq = d3.max(files, (f) => f.frequency) || 1;
    const colorScale = d3.scaleSequential(d3.interpolateRdYlBu).domain([maxFreq, 0]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const tooltip = d3.select(tooltipRef.current);
    const leaves = hierarchy.leaves();

    const cell = svg.selectAll("g")
      .data(leaves)
      .join("g")
      .attr("transform", (d) => `translate(${(d as unknown as { x0: number }).x0},${(d as unknown as { y0: number }).y0})`);

    cell.append("rect")
      .attr("width", (d) => Math.max(0, (d as unknown as { x1: number }).x1 - (d as unknown as { x0: number }).x0))
      .attr("height", (d) => Math.max(0, (d as unknown as { y1: number }).y1 - (d as unknown as { y0: number }).y0))
      .attr("fill", (d) => colorScale(d.value || 0))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        const fullPath = d.ancestors().reverse().map((a) => (a.data as { name: string }).name).slice(1).join("/");
        tooltip
          .style("opacity", "1")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 28}px`)
          .html(`<strong>${fullPath}</strong><br/>Changes: ${d.value}`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
      })
      .on("mouseout", () => { tooltip.style("opacity", "0"); });

    cell.append("text")
      .attr("x", 4)
      .attr("y", 14)
      .attr("font-size", "10px")
      .attr("fill", "#fff")
      .attr("pointer-events", "none")
      .text((d) => {
        const w = (d as unknown as { x1: number }).x1 - (d as unknown as { x0: number }).x0;
        const name = (d.data as { name: string }).name;
        return w > 40 ? (name.length > w / 7 ? name.slice(0, Math.floor(w / 7)) + "…" : name) : "";
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
  if (!data || data.files.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <p className="mb-3 text-xs text-gray-500">File hotspot treemap — sized by change frequency, colored cool (blue) to hot (red)</p>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

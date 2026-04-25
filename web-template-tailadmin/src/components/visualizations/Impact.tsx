"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface ChangedFile {
  path: string;
  additions?: number;
  deletions?: number;
}

interface ImpactCommit {
  hash?: string;
  commitDate?: string;
  authorEmail?: string;
  message?: string;
  changedFiles?: ChangedFile[];
}

export default function Impact({ repoId }: { repoId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ImpactCommit[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/impact?repoId=${encodeURIComponent(repoId)}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(Array.isArray(d) ? d : d.commits || []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    if (data.length === 0) return;

    const commit = data[selectedIdx];
    if (!commit) return;

    const files = commit.changedFiles || [];
    const totalLines = files.reduce((s, f) => s + (f.additions || 0) + (f.deletions || 0), 0);

    const width = containerRef.current.clientWidth || 700;
    const height = 500;
    const cx = width / 2;
    const cy = height / 2;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const tooltip = d3.select(tooltipRef.current);

    // Central circle
    const centerRadius = Math.max(15, Math.min(50, Math.sqrt(totalLines) * 1.5));
    svg.append("circle")
      .attr("cx", cx).attr("cy", cy)
      .attr("r", centerRadius)
      .attr("fill", "#6366f1")
      .attr("opacity", 0.8);

    svg.append("text")
      .attr("x", cx).attr("y", cy)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#fff")
      .attr("pointer-events", "none")
      .text(totalLines);

    if (files.length === 0) return;

    const maxFileLines = Math.max(...files.map((f) => (f.additions || 0) + (f.deletions || 0)), 1);
    const maxTendrilLen = Math.min(width, height) / 2 - centerRadius - 40;

    files.forEach((file, i) => {
      const angle = (2 * Math.PI * i) / files.length - Math.PI / 2;
      const adds = file.additions || 0;
      const dels = file.deletions || 0;
      const fileTotal = adds + dels;
      const len = centerRadius + (fileTotal / maxFileLines) * maxTendrilLen + 20;

      const x2 = cx + Math.cos(angle) * len;
      const y2 = cy + Math.sin(angle) * len;

      // Determine color: green for mostly adds, red for mostly dels, blue for mixed
      let color = "#3b82f6"; // blue
      if (adds > 0 && dels === 0) color = "#22c55e"; // green
      else if (dels > 0 && adds === 0) color = "#ef4444"; // red
      else if (adds > dels) color = "#22c55e";
      else if (dels > adds) color = "#ef4444";

      const strokeW = Math.max(1.5, Math.min(6, (fileTotal / maxFileLines) * 6));

      svg.append("line")
        .attr("x1", cx + Math.cos(angle) * centerRadius)
        .attr("y1", cy + Math.sin(angle) * centerRadius)
        .attr("x2", x2).attr("y2", y2)
        .attr("stroke", color)
        .attr("stroke-width", strokeW)
        .attr("stroke-linecap", "round")
        .attr("opacity", 0.7)
        .style("cursor", "pointer")
        .on("mouseover", (event) => {
          tooltip.style("opacity", "1")
            .style("left", `${event.offsetX + 12}px`)
            .style("top", `${event.offsetY - 28}px`)
            .html(`<strong>${file.path}</strong><br/><span style="color:#22c55e">+${adds}</span> <span style="color:#ef4444">-${dels}</span>`);
        })
        .on("mousemove", (event) => {
          tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
        })
        .on("mouseout", () => { tooltip.style("opacity", "0"); });

      // File dot at end
      svg.append("circle")
        .attr("cx", x2).attr("cy", y2)
        .attr("r", 3)
        .attr("fill", color);

      // Label for larger tendrils
      if (files.length <= 20 || fileTotal > maxFileLines * 0.3) {
        const labelX = cx + Math.cos(angle) * (len + 12);
        const labelY = cy + Math.sin(angle) * (len + 12);
        svg.append("text")
          .attr("x", labelX).attr("y", labelY)
          .attr("text-anchor", angle > Math.PI / 2 || angle < -Math.PI / 2 ? "end" : "start")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "9px")
          .attr("fill", "#6b7280")
          .attr("pointer-events", "none")
          .text(file.path.split("/").pop() || "");
      }
    });
  }, [data, selectedIdx]);

  useEffect(() => { renderChart(); }, [renderChart]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  const commit = data[selectedIdx];

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <div className="mb-3 flex items-center gap-4">
        <p className="text-xs text-gray-500">
          Commit {selectedIdx + 1}/{data.length}: <span className="font-mono">{commit?.hash?.slice(0, 7)}</span> by {commit?.authorEmail}
        </p>
        <div className="flex gap-1">
          <button onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))} disabled={selectedIdx === 0}
            className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-400">← Prev</button>
          <button onClick={() => setSelectedIdx(Math.min(data.length - 1, selectedIdx + 1))} disabled={selectedIdx === data.length - 1}
            className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-400">Next →</button>
        </div>
        <div className="flex gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-green-500" /> Additions</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-red-500" /> Deletions</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-blue-500" /> Mixed</span>
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

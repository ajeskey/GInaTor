"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface BubbleFile {
  path?: string;
  frequency?: number;
  contributors?: number;
  additions?: number;
  size?: number;
}

export default function BubbleMap({ repoId, from, to }: { repoId: string; from?: string; to?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<BubbleFile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/bubblemap?repoId=${encodeURIComponent(repoId)}${from ? `&from=${encodeURIComponent(from)}` : ""}${to ? `&to=${encodeURIComponent(to)}` : ""}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(Array.isArray(d) ? d : d.files || []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId, from, to]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    if (data.length === 0) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 550;

    // Build hierarchy by directory
    interface TreeNode {
      name: string;
      children?: TreeNode[];
      value?: number;
      filePath?: string;
      freq?: number;
      contribs?: number;
    }

    const root: TreeNode = { name: "root", children: [] };
    const dirMap = new Map<string, TreeNode>();
    dirMap.set("", root);

    data.forEach((f) => {
      if (!f.path) return;
      const parts = f.path.split("/");
      const fileName = parts.pop() || f.path;
      let dirPath = "";
      let parent = root;

      parts.forEach((part) => {
        const newPath = dirPath ? dirPath + "/" + part : part;
        if (!dirMap.has(newPath)) {
          const node: TreeNode = { name: part, children: [] };
          dirMap.set(newPath, node);
          if (!parent.children) parent.children = [];
          parent.children.push(node);
        }
        parent = dirMap.get(newPath)!;
        dirPath = newPath;
      });

      const leaf: TreeNode = {
        name: fileName,
        value: f.frequency || f.size || 1,
        filePath: f.path,
        freq: f.frequency,
        contribs: f.contributors,
      };
      if (!parent.children) parent.children = [];
      parent.children.push(leaf);
    });

    // Extension color
    const extensions = [...new Set(data.map((f) => {
      const ext = f.path?.split(".").pop() || "other";
      return ext;
    }))];
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(extensions);

    const hierarchy = d3.hierarchy(root)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3.pack<TreeNode>().size([width, height]).padding(3);
    pack(hierarchy);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const tooltip = d3.select(tooltipRef.current);

    type PackNode = d3.HierarchyCircularNode<TreeNode>;
    const nodes = hierarchy.descendants() as PackNode[];

    // Draw directory circles (non-leaf)
    svg.selectAll(".dir-circle")
      .data(nodes.filter((d) => d.children))
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", "none")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Draw leaf bubbles
    const leaves = nodes.filter((d) => !d.children);

    svg.selectAll(".bubble")
      .data(leaves)
      .join("circle")
      .attr("class", "bubble")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", (d) => {
        const ext = d.data.name.split(".").pop() || "other";
        return colorScale(ext);
      })
      .attr("opacity", 0.75)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", "1")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 28}px`)
          .html(`<strong>${d.data.filePath || d.data.name}</strong><br/>Frequency: ${d.data.freq ?? "—"}<br/>Contributors: ${d.data.contribs ?? "—"}`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
      })
      .on("mouseout", () => { tooltip.style("opacity", "0"); });

    // Labels for larger bubbles
    svg.selectAll(".bubble-label")
      .data(leaves.filter((d) => d.r > 18))
      .join("text")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", (d) => Math.min(d.r / 3, 11) + "px")
      .attr("fill", "#fff")
      .attr("pointer-events", "none")
      .text((d) => {
        const name = d.data.name;
        const maxLen = Math.floor(d.r / 4);
        return name.length > maxLen ? name.slice(0, maxLen) + "…" : name;
      });

    // Legend
    const legend = svg.append("g").attr("transform", `translate(10, ${height - extensions.slice(0, 8).length * 18 - 10})`);
    extensions.slice(0, 8).forEach((ext, i) => {
      legend.append("rect").attr("x", 0).attr("y", i * 18).attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", colorScale(ext));
      legend.append("text").attr("x", 18).attr("y", i * 18 + 10).attr("font-size", "10px").attr("fill", "#6b7280").text(`.${ext}`);
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
  if (!data || data.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <p className="mb-3 text-xs text-gray-500">Bubble map — sized by change frequency, clustered by directory, colored by file type</p>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

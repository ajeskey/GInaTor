"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface SunburstFile {
  path: string;
  primaryContributor: string;
  contributors: { author: string; count: number }[];
}

export default function Sunburst({ repoId }: { repoId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ files: SunburstFile[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/sunburst?repoId=${encodeURIComponent(repoId)}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    const { files } = data;
    if (files.length === 0) return;

    const size = Math.min(containerRef.current.clientWidth || 700, 700);
    const radius = size / 2;

    // Build hierarchy
    interface TreeNode {
      name: string;
      children: TreeNode[];
      value?: number;
      contributor?: string;
      contribDetails?: { author: string; count: number }[];
    }
    const root: TreeNode = { name: "root", children: [] };
    const map = new Map<string, TreeNode>();
    map.set("root", root);

    files.forEach((f) => {
      const parts = f.path.split("/");
      let currentPath = "root";
      let parent = root;
      parts.forEach((part, i) => {
        const newPath = currentPath + "/" + part;
        if (!map.has(newPath)) {
          const node: TreeNode = { name: part, children: [] };
          if (i === parts.length - 1) {
            const total = f.contributors.reduce((s, c) => s + c.count, 0);
            node.value = total || 1;
            node.contributor = f.primaryContributor;
            node.contribDetails = f.contributors;
          }
          map.set(newPath, node);
          parent.children.push(node);
        }
        parent = map.get(newPath)!;
        currentPath = newPath;
      });
    });

    const allContributors = [...new Set(files.map((f) => f.primaryContributor))];
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(allContributors);

    const hierarchy = d3.hierarchy(root)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition<TreeNode>().size([2 * Math.PI, radius]);
    partition(hierarchy);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", size).attr("height", size);

    const g = svg.append("g").attr("transform", `translate(${radius},${radius})`);
    const tooltip = d3.select(tooltipRef.current);

    type PartNode = d3.HierarchyRectangularNode<TreeNode>;
    const arc = d3.arc<PartNode>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 - 1);

    const nodes = hierarchy.descendants().filter((d) => d.depth > 0) as PartNode[];

    g.selectAll("path")
      .data(nodes)
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => {
        let node: typeof d | null = d;
        while (node) {
          if (node.data.contributor) return colorScale(node.data.contributor);
          node = node.parent;
        }
        return "#e5e7eb";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        const path = d.ancestors().reverse().map((a) => a.data.name).slice(1).join("/");
        let html = `<strong>${path}</strong><br/>`;
        if (d.data.contribDetails) {
          const total = d.data.contribDetails.reduce((s, c) => s + c.count, 0);
          d.data.contribDetails.slice(0, 5).forEach((c) => {
            const pct = total > 0 ? ((c.count / total) * 100).toFixed(1) : "0";
            html += `${c.author}: ${pct}%<br/>`;
          });
        } else if (d.data.contributor) {
          html += `Primary: ${d.data.contributor}`;
        }
        tooltip.style("opacity", "1")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 28}px`)
          .html(html);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY - 28}px`);
      })
      .on("mouseout", () => { tooltip.style("opacity", "0"); });

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${size - 120}, 20)`);
    allContributors.slice(0, 10).forEach((c, i) => {
      legend.append("rect").attr("x", 0).attr("y", i * 18).attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", colorScale(c));
      legend.append("text").attr("x", 18).attr("y", i * 18 + 10).attr("font-size", "10px").attr("fill", "#6b7280")
        .text(c.length > 14 ? c.slice(0, 12) + "…" : c);
    });
  }, [data]);

  useEffect(() => { renderChart(); }, [renderChart]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.files.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  return (
    <div ref={containerRef} className="relative flex justify-center overflow-hidden">
      <div>
        <p className="mb-3 text-xs text-gray-500">Code ownership sunburst — colored by primary contributor</p>
        <svg ref={svgRef} />
      </div>
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

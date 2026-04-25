"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface CollabNode {
  author: string;
  commitCount: number;
}

interface CollabEdge {
  source: string;
  target: string;
  sharedFiles: number;
}

interface CollabData {
  nodes: CollabNode[];
  edges: CollabEdge[];
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  commitCount: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  sharedFiles: number;
}

export default function Collaboration({ repoId, from, to }: { repoId: string; from?: string; to?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CollabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/collaboration?repoId=${encodeURIComponent(repoId)}${from ? `&from=${encodeURIComponent(from)}` : ""}${to ? `&to=${encodeURIComponent(to)}` : ""}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId, from, to]);

  const renderChart = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    if (data.nodes.length === 0) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 500;

    const nodes: SimNode[] = data.nodes.map((n) => ({ id: n.author, commitCount: n.commitCount }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: SimLink[] = data.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, sharedFiles: e.sharedFiles }));

    const maxCommits = d3.max(nodes, (n) => n.commitCount) || 1;
    const maxShared = d3.max(links, (l) => l.sharedFiles) || 1;
    const radiusScale = d3.scaleSqrt().domain([0, maxCommits]).range([6, 30]);
    const linkWidthScale = d3.scaleLinear().domain([0, maxShared]).range([1, 8]);
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g");
    const tooltip = d3.select(tooltipRef.current);

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => { g.attr("transform", event.transform); });
    svg.call(zoom);

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<SimNode>().radius((d) => radiusScale(d.commitCount) + 4));

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#d1d5db")
      .attr("stroke-width", (d) => linkWidthScale(d.sharedFiles))
      .attr("stroke-opacity", 0.6);

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "grab");

    node.append("circle")
      .attr("r", (d) => radiusScale(d.commitCount))
      .attr("fill", (d) => colorScale(d.id))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("opacity", 0.85);

    node.append("text")
      .attr("dy", (d) => radiusScale(d.commitCount) + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#6b7280")
      .attr("pointer-events", "none")
      .text((d) => d.id.length > 16 ? d.id.slice(0, 14) + "…" : d.id);

    // Drag
    const drag = d3.drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
    node.call(drag);

    // Tooltips
    node.on("mouseover", (event, d) => {
      const connections = links.filter((l) => {
        const s = typeof l.source === "object" ? (l.source as SimNode).id : l.source;
        const t = typeof l.target === "object" ? (l.target as SimNode).id : l.target;
        return s === d.id || t === d.id;
      });
      tooltip.style("opacity", "1")
        .style("left", `${event.offsetX + 12}px`)
        .style("top", `${event.offsetY - 28}px`)
        .html(`<strong>${d.id}</strong><br/>${d.commitCount} commits<br/>${connections.length} collaborators`);
    })
    .on("mouseout", () => { tooltip.style("opacity", "0"); });

    link.on("mouseover", (event, d) => {
      const s = typeof d.source === "object" ? (d.source as SimNode).id : d.source;
      const t = typeof d.target === "object" ? (d.target as SimNode).id : d.target;
      tooltip.style("opacity", "1")
        .style("left", `${event.offsetX + 12}px`)
        .style("top", `${event.offsetY - 28}px`)
        .html(`<strong>${s} ↔ ${t}</strong><br/>${d.sharedFiles} shared files`);
    })
    .on("mouseout", () => { tooltip.style("opacity", "0"); });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x || 0)
        .attr("y1", (d) => (d.source as SimNode).y || 0)
        .attr("x2", (d) => (d.target as SimNode).x || 0)
        .attr("y2", (d) => (d.target as SimNode).y || 0);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [data]);

  useEffect(() => { renderChart(); }, [renderChart]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.edges.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <p className="mb-3 text-xs text-gray-500">Author collaboration network — node size = commits, edge thickness = shared files. Drag nodes to rearrange.</p>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        style={{ zIndex: 50 }}
      />
    </div>
  );
}

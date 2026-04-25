"use client";
import { useEffect, useState, useCallback, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TimelineScrubber from "@/components/TimelineScrubber";
import { useRepo } from "@/context/RepoContext";
import {
  Stats,
  Heatmap,
  Treemap,
  Sunburst,
  Pulse,
  Collaboration,
  FileTypes,
  ActivityMatrix,
  Branches,
  Impact,
  BubbleMap,
  Complexity,
  PRFlow,
  BusFactor,
  StaleFiles,
  Timeline,
  CityBlock,
  TimeBloom,
} from "@/components/visualizations";

const VIZ_COMPONENTS: Record<string, ComponentType<{ repoId: string; from?: string; to?: string }>> = {
  stats: Stats,
  heatmap: Heatmap,
  treemap: Treemap,
  sunburst: Sunburst,
  pulse: Pulse,
  collaboration: Collaboration,
  filetypes: FileTypes,
  "activity-matrix": ActivityMatrix,
  branches: Branches,
  impact: Impact,
  bubblemap: BubbleMap,
  complexity: Complexity,
  "pr-flow": PRFlow,
  "bus-factor": BusFactor,
  "stale-files": StaleFiles,
  timeline: Timeline,
  "city-block": CityBlock,
  "time-bloom": TimeBloom,
};

const VIZ_LABELS: Record<string, string> = {
  stats: "Stats",
  heatmap: "Heatmap",
  treemap: "Treemap",
  sunburst: "Sunburst",
  pulse: "Pulse",
  collaboration: "Collaboration Graph",
  filetypes: "File Types",
  "activity-matrix": "Activity Matrix",
  branches: "Branches",
  impact: "Impact",
  bubblemap: "Bubble Map",
  complexity: "Complexity",
  "pr-flow": "PR Flow",
  "bus-factor": "Bus Factor",
  "stale-files": "Stale Files",
  timeline: "Timeline",
  "city-block": "City Block",
  "time-bloom": "TimeBloom",
};

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedRepo } = useRepo();
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  // Read viz type from URL query param — sidebar links set ?viz=xxx
  const activeViz = searchParams.get("viz") || "stats";

  const handleRangeChange = useCallback((from: string | null, to: string | null) => {
    setDateFrom(from);
    setDateTo(to);
  }, []);

  useEffect(() => {
    fetch("/auth/status", { credentials: "include" })
      .then((r) => {
        if (!r.ok) {
          return fetch("/api/v1/guest-access")
            .then((gr) => gr.json())
            .then((gd) => {
              if (!gd.enabled) router.push("/signin");
              return null;
            })
            .catch(() => { router.push("/signin"); return null; });
        }
        return null;
      })
      .catch(() => {
        fetch("/api/v1/guest-access")
          .then((gr) => gr.json())
          .then((gd) => { if (!gd.enabled) router.push("/signin"); })
          .catch(() => router.push("/signin"));
      });
  }, [router]);

  const ActiveComponent = VIZ_COMPONENTS[activeViz];
  const vizLabel = VIZ_LABELS[activeViz] || activeViz;

  return (
    <div className="space-y-6">
      {/* Timeline Scrubber */}
      {selectedRepo && <TimelineScrubber repoId={selectedRepo} onRangeChange={handleRangeChange} />}

      {/* Visualization */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">{vizLabel}</h2>
        </div>
        <div className="min-h-[400px] p-6">
          {!selectedRepo ? (
            <div className="flex min-h-[350px] items-center justify-center">
              <p className="text-sm text-gray-400">Select a repository to view visualizations</p>
            </div>
          ) : ActiveComponent ? (
            <ActiveComponent repoId={selectedRepo} {...(dateFrom ? { from: dateFrom } : {})} {...(dateTo ? { to: dateTo } : {})} />
          ) : (
            <p className="text-sm text-gray-400">Select a visualization from the sidebar</p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState, useCallback, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import TimelineScrubber from "@/components/TimelineScrubber";
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

const VIZ_TYPES = [
  { key: "stats", label: "Stats" },
  { key: "heatmap", label: "Heatmap" },
  { key: "treemap", label: "Treemap" },
  { key: "sunburst", label: "Sunburst" },
  { key: "pulse", label: "Pulse" },
  { key: "collaboration", label: "Collaboration Graph" },
  { key: "filetypes", label: "File Types" },
  { key: "activity-matrix", label: "Activity Matrix" },
  { key: "branches", label: "Branches" },
  { key: "impact", label: "Impact" },
  { key: "bubblemap", label: "Bubble Map" },
  { key: "complexity", label: "Complexity" },
  { key: "pr-flow", label: "PR Flow" },
  { key: "bus-factor", label: "Bus Factor" },
  { key: "stale-files", label: "Stale Files" },
  { key: "timeline", label: "Timeline" },
  { key: "city-block", label: "City Block" },
  { key: "time-bloom", label: "TimeBloom" },
] as const;

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

interface RepoConfig {
  repoId: string;
  name?: string;
  providerType?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [activeViz, setActiveViz] = useState<string>("stats");
  const [repos, setRepos] = useState<RepoConfig[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [reposLoading, setReposLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const handleRangeChange = useCallback((from: string | null, to: string | null) => {
    setDateFrom(from);
    setDateTo(to);
  }, []);

  useEffect(() => {
    fetch("/auth/status", { credentials: "include" })
      .then((r) => {
        if (!r.ok) {
          // Auth failed — check if guest access is enabled
          return fetch("/api/v1/guest-access")
            .then((gr) => gr.json())
            .then((gd) => {
              if (gd.enabled) {
                setIsGuest(true);
                return null;
              }
              router.push("/signin");
              return null;
            })
            .catch(() => {
              router.push("/signin");
              return null;
            });
        }
        return r.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {
        // Check guest access as fallback
        fetch("/api/v1/guest-access")
          .then((gr) => gr.json())
          .then((gd) => {
            if (gd.enabled) {
              setIsGuest(true);
            } else {
              router.push("/signin");
            }
          })
          .catch(() => router.push("/signin"));
      });
  }, [router]);

  useEffect(() => {
    // Guests can't access /admin, so skip repo fetching in guest mode
    if (isGuest) {
      setReposLoading(false);
      return;
    }
    fetch("/admin", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch repos");
        return r.json();
      })
      .then((data) => {
        const configs: RepoConfig[] = data.repoConfigs || [];
        setRepos(configs);
        if (configs.length > 0 && !selectedRepo) {
          setSelectedRepo(configs[0].repoId);
        }
        setReposLoading(false);
      })
      .catch(() => {
        setReposLoading(false);
      });
  }, [isGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  const ActiveComponent = VIZ_COMPONENTS[activeViz];

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                Welcome to GInaTor
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isGuest
                  ? "Viewing as guest (read-only)"
                  : user
                    ? `Signed in as ${user.email}`
                    : "Git repository visualization dashboard"}
              </p>
            </div>
          </div>

          {/* Repo Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="repo-select" className="text-sm text-gray-500 dark:text-gray-400">
              Repository:
            </label>
            {reposLoading ? (
              <span className="text-sm text-gray-400">Loading...</span>
            ) : repos.length === 0 ? (
              <span className="text-sm text-gray-400">No repos configured</span>
            ) : (
              <select
                id="repo-select"
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                {repos.map((r) => (
                  <option key={r.repoId} value={r.repoId}>
                    {r.name || r.repoId}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Scrubber */}
      {selectedRepo && (
        <TimelineScrubber repoId={selectedRepo} onRangeChange={handleRangeChange} />
      )}

      {/* Visualization Selector */}
      <div className="grid grid-cols-12 gap-6">
        {/* Viz Type Pills */}
        <div className="col-span-12">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Visualization Type
            </h2>
            <div className="flex flex-wrap gap-2">
              {VIZ_TYPES.map((viz) => (
                <button
                  key={viz.key}
                  onClick={() => setActiveViz(viz.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    activeViz === viz.key
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/[0.05] dark:text-gray-400 dark:hover:bg-white/[0.08]"
                  }`}
                >
                  {viz.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visualization Container */}
        <div className="col-span-12">
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
                {VIZ_TYPES.find((v) => v.key === activeViz)?.label}
              </h2>
            </div>
            <div className="min-h-[400px] p-6">
              {!selectedRepo ? (
                <div className="flex min-h-[350px] items-center justify-center">
                  <p className="text-sm text-gray-400">Select a repository to view visualizations</p>
                </div>
              ) : ActiveComponent ? (
                <ActiveComponent repoId={selectedRepo} {...(dateFrom ? { from: dateFrom } : {})} {...(dateTo ? { to: dateTo } : {})} />
              ) : (
                <p className="text-sm text-gray-400">Unknown visualization type</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

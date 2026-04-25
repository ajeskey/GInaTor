"use client";
import { useEffect, useState } from "react";

interface StatsData {
  contributorCount: number;
  fileCount: number;
  firstCommitDate: string | null;
  lastCommitDate: string | null;
  commitCount: number;
}

export default function Stats({ repoId, from, to }: { repoId: string; from?: string; to?: string }) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    let url = `/api/v1/stats?repoId=${encodeURIComponent(repoId)}`;
    if (from) url += `&from=${encodeURIComponent(from)}`;
    if (to) url += `&to=${encodeURIComponent(to)}`;
    fetch(url, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId, from, to]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.commitCount === 0) return <p className="text-sm text-gray-400">No data available</p>;

  const cards = [
    { label: "Contributors", value: data.contributorCount, icon: "👥" },
    { label: "Files", value: data.fileCount, icon: "📁" },
    { label: "Commits", value: data.commitCount, icon: "📝" },
    { label: "First Commit", value: data.firstCommitDate?.slice(0, 10) ?? "—", icon: "🗓️" },
    { label: "Last Commit", value: data.lastCommitDate?.slice(0, 10) ?? "—", icon: "🕐" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-white/[0.03]">
          <div className="mb-2 text-2xl">{c.icon}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
          <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

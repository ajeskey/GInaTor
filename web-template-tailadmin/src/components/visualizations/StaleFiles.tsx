"use client";
import { useEffect, useState } from "react";

interface StaleFile {
  path: string;
  lastModified: string;
  lastAuthor: string;
  monthsSince: number;
}

interface StaleFilesData {
  files: StaleFile[];
}

export default function StaleFiles({ repoId }: { repoId: string }) {
  const [data, setData] = useState<StaleFilesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/stale-files?repoId=${encodeURIComponent(repoId)}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.files.length === 0) return <p className="text-sm text-gray-400">No stale files found</p>;

  const sorted = [...data.files].sort((a, b) => b.monthsSince - a.monthsSince);
  const criticalCount = sorted.filter((f) => f.monthsSince > 12).length;

  const staleBadge = (months: number) => {
    if (months > 24) return "bg-red-500 text-white";
    if (months > 12) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (months > 6) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  };

  const staleBar = (months: number) => {
    const maxMonths = sorted[0]?.monthsSince || 1;
    const pct = Math.min((months / maxMonths) * 100, 100);
    const color = months > 12 ? "bg-red-400" : months > 6 ? "bg-amber-400" : "bg-yellow-400";
    return { pct, color };
  };

  return (
    <div className="overflow-auto">
      <div className="mb-4 flex items-center gap-4">
        <p className="text-xs text-gray-500">{sorted.length} stale files detected</p>
        {criticalCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
            </svg>
            {criticalCount} files stale &gt;12 months
          </span>
        )}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-gray-200 dark:border-gray-700">
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">File</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Last Modified</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Last Author</th>
            <th className="px-3 py-2.5 text-center font-semibold text-gray-500">Months</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Staleness</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 100).map((f) => {
            const bar = staleBar(f.monthsSince);
            return (
              <tr key={f.path} className={`border-b transition-colors ${
                f.monthsSince > 12
                  ? "border-red-100 bg-red-50/40 dark:border-red-900/20 dark:bg-red-900/5"
                  : "border-gray-100 dark:border-gray-800"
              } hover:bg-gray-50 dark:hover:bg-white/[0.02]`}>
                <td className="max-w-[250px] truncate px-3 py-2 font-mono text-[11px] text-gray-700 dark:text-gray-300" title={f.path}>{f.path}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{f.lastModified?.slice(0, 10)}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{f.lastAuthor}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${staleBadge(f.monthsSince)}`}>
                    {f.monthsSince}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="h-2 w-24 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className={`h-2 rounded-full ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length > 100 && <p className="mt-3 text-xs text-gray-400">Showing first 100 of {sorted.length} files</p>}
    </div>
  );
}

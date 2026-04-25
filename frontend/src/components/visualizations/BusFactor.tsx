"use client";
import { useEffect, useState } from "react";

interface BusFactorFile {
  path: string;
  busFactor: number;
  contributors: string[];
}

interface BusFactorData {
  files: BusFactorFile[];
}

export default function BusFactor({ repoId, from, to }: { repoId: string; from?: string; to?: string }) {
  const [data, setData] = useState<BusFactorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/bus-factor?repoId=${encodeURIComponent(repoId)}${from ? `&from=${encodeURIComponent(from)}` : ""}${to ? `&to=${encodeURIComponent(to)}` : ""}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId, from, to]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.files.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  const sorted = [...data.files].sort((a, b) => a.busFactor - b.busFactor);
  const riskCount = sorted.filter((f) => f.busFactor === 1).length;

  return (
    <div className="overflow-auto">
      <div className="mb-4 flex items-center gap-4">
        <p className="text-xs text-gray-500">{sorted.length} files analyzed</p>
        {riskCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            {riskCount} files at risk (bus factor = 1)
          </span>
        )}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-gray-200 dark:border-gray-700">
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">File</th>
            <th className="px-3 py-2.5 text-center font-semibold text-gray-500">Bus Factor</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Contributors</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 100).map((f) => (
            <tr key={f.path} className={`border-b transition-colors ${
              f.busFactor === 1
                ? "border-red-100 bg-red-50/60 hover:bg-red-50 dark:border-red-900/20 dark:bg-red-900/10 dark:hover:bg-red-900/20"
                : "border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.02]"
            }`}>
              <td className="max-w-[300px] truncate px-3 py-2 text-gray-700 dark:text-gray-300" title={f.path}>
                <span className="font-mono text-[11px]">{f.path}</span>
              </td>
              <td className="px-3 py-2 text-center">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  f.busFactor === 1
                    ? "bg-red-500 text-white"
                    : f.busFactor <= 2
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                }`}>
                  {f.busFactor}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {f.contributors.slice(0, 5).map((c) => (
                    <span key={c} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {c}
                    </span>
                  ))}
                  {f.contributors.length > 5 && (
                    <span className="text-[10px] text-gray-400">+{f.contributors.length - 5} more</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length > 100 && <p className="mt-3 text-xs text-gray-400">Showing first 100 of {sorted.length} files</p>}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";

interface BranchCommit {
  hash?: string;
  commitDate?: string;
  authorEmail?: string;
  message?: string;
  branch?: string;
}

const BRANCH_COLORS = [
  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
];

export default function Branches({ repoId, from, to }: { repoId: string; from?: string; to?: string }) {
  const [data, setData] = useState<BranchCommit[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/branches?repoId=${encodeURIComponent(repoId)}${from ? `&from=${encodeURIComponent(from)}` : ""}${to ? `&to=${encodeURIComponent(to)}` : ""}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(Array.isArray(d) ? d : d.commits || d.branches || []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId, from, to]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!data || data.length === 0) return <p className="text-sm text-gray-400">No data available</p>;

  const branches = [...new Set(data.map((c) => c.branch || "unknown"))];
  const branchColorMap = new Map(branches.map((b, i) => [b, BRANCH_COLORS[i % BRANCH_COLORS.length]]));

  return (
    <div className="overflow-auto">
      <div className="mb-4 flex flex-wrap gap-2">
        {branches.map((b) => (
          <span key={b} className={`rounded-full px-2.5 py-1 text-xs font-medium ${branchColorMap.get(b)}`}>
            {b}
          </span>
        ))}
      </div>
      <p className="mb-2 text-xs text-gray-500">{data.length} commits across {branches.length} branches</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-gray-200 dark:border-gray-700">
            <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Hash</th>
            <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Date</th>
            <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Author</th>
            <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Branch</th>
            <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Message</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 100).map((c, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.02] transition-colors">
              <td className="px-3 py-2 font-mono text-gray-500">{c.hash?.slice(0, 7)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-500">{c.commitDate?.slice(0, 10)}</td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{c.authorEmail}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${branchColorMap.get(c.branch || "unknown")}`}>
                  {c.branch || "—"}
                </span>
              </td>
              <td className="max-w-[350px] truncate px-3 py-2 text-gray-600 dark:text-gray-400">{c.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 100 && <p className="mt-3 text-xs text-gray-400">Showing first 100 of {data.length} commits</p>}
    </div>
  );
}

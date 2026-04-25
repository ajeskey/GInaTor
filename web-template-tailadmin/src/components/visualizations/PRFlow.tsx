"use client";
import { useEffect, useState } from "react";

interface PRData {
  prs?: { id: number; title: string; state: string; author: string; createdAt: string }[];
}

export default function PRFlow({ repoId }: { repoId: string }) {
  const [data, setData] = useState<PRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/pr-flow?repoId=${encodeURIComponent(repoId)}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [repoId]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  const prs = data?.prs || [];
  if (prs.length === 0) {
    return (
      <div className="flex min-h-[350px] flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20">
          <svg className="h-10 w-10 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </div>
        <h3 className="mb-2 text-base font-semibold text-gray-700 dark:text-gray-300">GitHub / GitLab Only</h3>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          PR/MR Review Flow visualization requires a GitHub or GitLab integration.
          Configure a remote provider for this repository to see pull request flow data.
        </p>
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-gray-800">GitHub</span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-gray-800">GitLab</span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-gray-200 dark:border-gray-700">
            <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">PR</th>
            <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Title</th>
            <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Author</th>
            <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">State</th>
          </tr>
        </thead>
        <tbody>
          {prs.slice(0, 50).map((pr) => (
            <tr key={pr.id} className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.02] transition-colors">
              <td className="px-3 py-2 font-mono text-gray-500">#{pr.id}</td>
              <td className="max-w-[300px] truncate px-3 py-2 text-gray-700 dark:text-gray-300">{pr.title}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{pr.author}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pr.state === "open" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"}`}>
                  {pr.state}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

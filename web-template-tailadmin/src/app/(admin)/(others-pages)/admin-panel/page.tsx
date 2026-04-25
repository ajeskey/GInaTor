"use client";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface PendingUser {
  userId: string;
  email: string;
  createdAt?: string;
}

interface RepoConfig {
  repoId: string;
  name: string;
  providerType: string;
  providerConfig?: Record<string, unknown>;
  lastSyncAt?: string;
}

export default function AdminPanelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [repoConfigs, setRepoConfigs] = useState<RepoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Repo form
  const [repoName, setRepoName] = useState("");
  const [repoProvider, setRepoProvider] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [localPathValid, setLocalPathValid] = useState<boolean | null>(null);
  const [localPathError, setLocalPathError] = useState("");
  const [validatingPath, setValidatingPath] = useState(false);

  // GitHub connection
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [githubLoading, setGithubLoading] = useState(true);

  // AI config
  const [aiProvider, setAiProvider] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");

  // Prompt template
  const [promptTemplate, setPromptTemplate] = useState("");

  // Sprint marker
  const [markerLabel, setMarkerLabel] = useState("");
  const [markerDate, setMarkerDate] = useState("");

  // Digest config
  const [digestEnabled, setDigestEnabled] = useState("");
  const [digestSchedule, setDigestSchedule] = useState("");
  const [digestRecipients, setDigestRecipients] = useState("");

  // Webhook config
  const [webhookRepoId, setWebhookRepoId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  useEffect(() => {
    loadAdminData();
    checkGitHubStatus();
  }, []);

  useEffect(() => {
    const ghParam = searchParams.get("github");
    if (ghParam === "connected") {
      showMessage("GitHub connected successfully!");
      checkGitHubStatus();
    } else if (ghParam === "error") {
      showMessage("GitHub connection failed. Please try again.");
    }
  }, [searchParams]);

  async function checkGitHubStatus() {
    try {
      const res = await fetch("/auth/github/status", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setGithubConnected(data.connected);
        setGithubUsername(data.username || "");
      }
    } catch {
      // Ignore errors
    } finally {
      setGithubLoading(false);
    }
  }

  async function loadAdminData() {
    try {
      const res = await fetch("/admin", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/signin");
        return;
      }
      const data = await res.json();
      if (data.pendingUsers) setPendingUsers(data.pendingUsers);
      if (data.repoConfigs) setRepoConfigs(data.repoConfigs);
    } catch {
      // Admin data may not be available via JSON yet
    } finally {
      setLoading(false);
    }
  }

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  async function approveUser(id: string) {
    const res = await fetch(`/admin/users/${id}/approve`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      setPendingUsers((u) => u.filter((x) => x.userId !== id));
      showMessage("User approved");
    }
  }

  async function rejectUser(id: string) {
    const res = await fetch(`/admin/users/${id}/reject`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      setPendingUsers((u) => u.filter((x) => x.userId !== id));
      showMessage("User rejected");
    }
  }

  async function validateLocalPath() {
    if (!localPath) return;
    setValidatingPath(true);
    setLocalPathValid(null);
    setLocalPathError("");
    try {
      const res = await fetch("/admin/repos/validate-local", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: localPath }),
      });
      const data = await res.json();
      setLocalPathValid(data.valid);
      if (!data.valid) setLocalPathError(data.error || "Invalid path");
    } catch {
      setLocalPathValid(false);
      setLocalPathError("Validation request failed");
    } finally {
      setValidatingPath(false);
    }
  }

  async function saveRepo(e: React.FormEvent) {
    e.preventDefault();
    const providerConfig: Record<string, unknown> =
      repoProvider === "local"
        ? { path: localPath }
        : { url: repoUrl, pat: "" };
    const res = await fetch("/admin/repos", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: repoName, providerType: repoProvider, providerConfig }),
    });
    if (res.ok) {
      showMessage("Repository config saved");
      setRepoName("");
      setRepoProvider("");
      setRepoUrl("");
      setLocalPath("");
      setLocalPathValid(null);
      setLocalPathError("");
      loadAdminData();
    }
  }

  async function saveAiConfig(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/admin/ai-config", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey }),
    });
    if (res.ok) showMessage("AI config saved");
  }

  async function savePrompt(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/admin/prompt", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: promptTemplate }),
    });
    if (res.ok) showMessage("Prompt template saved");
  }

  async function saveMarker(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/admin/markers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: markerLabel, date: markerDate }),
    });
    if (res.ok) showMessage("Sprint marker saved");
  }

  async function saveDigest(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/admin/digest", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: digestEnabled === "yes",
        schedule: digestSchedule,
        recipients: digestRecipients,
      }),
    });
    if (res.ok) showMessage("Digest config saved");
  }

  async function saveWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!webhookRepoId) return;
    const res = await fetch(`/admin/webhooks/${webhookRepoId}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: webhookSecret }),
    });
    if (res.ok) showMessage("Webhook config saved");
  }

  async function deleteRepo(id: string) {
    const res = await fetch(`/admin/repos/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setRepoConfigs((r) => r.filter((x) => x.repoId !== id));
      showMessage("Repository deleted");
    }
  }

  async function syncRepo(id: string) {
    showMessage("Syncing…");
    try {
      const res = await fetch(`/admin/sync/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`Sync complete: ${data.fetched} commits fetched, ${data.created} new, ${data.skipped} skipped`);
      } else {
        showMessage(`Sync failed: ${data.error}`);
      }
    } catch {
      showMessage("Sync failed: network error");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading admin panel…</p>
      </div>
    );
  }

  const cardClass =
    "rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]";
  const headingClass =
    "mb-4 text-base font-semibold text-gray-800 dark:text-white/90";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
        Admin Panel
      </h1>

      {message && (
        <div className="rounded-lg bg-success-50 p-3 text-sm text-success-600 dark:bg-success-500/10 dark:text-success-400">
          {message}
        </div>
      )}

      {/* GitHub Connection */}
      <div className={cardClass}>
        <h2 className={headingClass}>GitHub Connection</h2>
        {githubLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Checking GitHub status…</p>
        ) : githubConnected ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-sm font-medium text-success-600 dark:bg-success-500/10 dark:text-success-400">
              <span className="inline-block h-2 w-2 rounded-full bg-success-500" />
              Connected
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              as <span className="font-medium">@{githubUsername}</span>
            </span>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              Connect your GitHub account to access repositories.
            </p>
            <a
              href="/auth/github"
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              Connect GitHub
            </a>
          </div>
        )}
      </div>

      {/* User Management */}
      <div className={cardClass}>
        <h2 className={headingClass}>Pending Users</h2>
        {pendingUsers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No pending users.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-left font-medium text-gray-600 dark:text-gray-400">
                    Email
                  </th>
                  <th className="pb-2 text-right font-medium text-gray-600 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((u) => (
                  <tr
                    key={u.userId}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-3 text-gray-800 dark:text-white/90">
                      {u.email}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => approveUser(u.userId)}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectUser(u.userId)}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Repository Config */}
      <div className={cardClass}>
        <h2 className={headingClass}>Repository Configuration</h2>
        {repoConfigs.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-left font-medium text-gray-600 dark:text-gray-400">
                    Name
                  </th>
                  <th className="pb-2 text-left font-medium text-gray-600 dark:text-gray-400">
                    Provider
                  </th>
                  <th className="pb-2 text-right font-medium text-gray-600 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {repoConfigs.map((r) => (
                  <tr
                    key={r.repoId}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-3 text-gray-800 dark:text-white/90">
                      {r.name}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {r.providerType}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => syncRepo(r.repoId)}
                        >
                          Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteRepo(r.repoId)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={saveRepo} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label>Repository Name</Label>
            <Input
              placeholder="my-repo"
              onChange={(e) => setRepoName(e.target.value)}
              defaultValue={repoName}
            />
          </div>
          <div>
            <Label>Provider</Label>
            <Select
              options={[
                { value: "github", label: "GitHub" },
                { value: "gitlab", label: "GitLab" },
                { value: "codecommit", label: "CodeCommit" },
                { value: "local", label: "Local" },
              ]}
              placeholder="Select provider"
              onChange={(v) => {
                setRepoProvider(v);
                setLocalPathValid(null);
                setLocalPathError("");
              }}
            />
          </div>
          {repoProvider === "local" ? (
            <div>
              <Label>Local Path</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="/path/to/repo"
                    onChange={(e) => {
                      setLocalPath(e.target.value);
                      setLocalPathValid(null);
                      setLocalPathError("");
                    }}
                    defaultValue={localPath}
                  />
                </div>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={validateLocalPath}
                  disabled={validatingPath || !localPath}
                >
                  {validatingPath ? "…" : "Validate"}
                </Button>
              </div>
              {localPathValid === true && (
                <p className="mt-1 flex items-center gap-1 text-xs text-success-600 dark:text-success-400">
                  <span>✓</span> Valid git repository
                </p>
              )}
              {localPathValid === false && (
                <p className="mt-1 flex items-center gap-1 text-xs text-error-600 dark:text-error-400">
                  <span>✗</span> {localPathError}
                </p>
              )}
            </div>
          ) : (
            <div>
              <Label>Repository URL</Label>
              <Input
                placeholder="https://github.com/org/repo"
                onChange={(e) => setRepoUrl(e.target.value)}
                defaultValue={repoUrl}
              />
            </div>
          )}
          <div className="sm:col-span-3">
            <Button size="sm">Add Repository</Button>
          </div>
        </form>
      </div>

      {/* AI Provider Config */}
      <div className={cardClass}>
        <h2 className={headingClass}>AI Provider Configuration</h2>
        <form onSubmit={saveAiConfig} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>AI Provider</Label>
            <Select
              options={[
                { value: "openai", label: "OpenAI" },
                { value: "anthropic", label: "Anthropic" },
                { value: "bedrock", label: "AWS Bedrock" },
              ]}
              placeholder="Select AI provider"
              onChange={(v) => setAiProvider(v)}
            />
          </div>
          <div>
            <Label>API Key</Label>
            <Input
              type="password"
              placeholder="sk-..."
              onChange={(e) => setAiApiKey(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm">Save AI Config</Button>
          </div>
        </form>
      </div>

      {/* Prompt Template */}
      <div className={cardClass}>
        <h2 className={headingClass}>Prompt Template</h2>
        <form onSubmit={savePrompt} className="space-y-4">
          <div>
            <Label>Release Notes Prompt</Label>
            <textarea
              className="h-32 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              placeholder="Enter your prompt template…"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
            />
          </div>
          <Button size="sm">Save Template</Button>
        </form>
      </div>

      {/* Sprint Markers */}
      <div className={cardClass}>
        <h2 className={headingClass}>Sprint / Release Markers</h2>
        <form onSubmit={saveMarker} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Label</Label>
            <Input
              placeholder="Sprint 42"
              onChange={(e) => setMarkerLabel(e.target.value)}
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              onChange={(e) => setMarkerDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm">Add Marker</Button>
          </div>
        </form>
      </div>

      {/* Digest Email */}
      <div className={cardClass}>
        <h2 className={headingClass}>Digest Email Configuration</h2>
        <form onSubmit={saveDigest} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label>Enabled</Label>
            <Select
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              placeholder="Enable digest?"
              onChange={(v) => setDigestEnabled(v)}
            />
          </div>
          <div>
            <Label>Schedule (cron)</Label>
            <Input
              placeholder="0 9 * * 1"
              onChange={(e) => setDigestSchedule(e.target.value)}
            />
          </div>
          <div>
            <Label>Recipients</Label>
            <Input
              placeholder="team@example.com"
              onChange={(e) => setDigestRecipients(e.target.value)}
            />
          </div>
          <div className="sm:col-span-3">
            <Button size="sm">Save Digest Config</Button>
          </div>
        </form>
      </div>

      {/* Webhook Config */}
      <div className={cardClass}>
        <h2 className={headingClass}>Webhook Configuration</h2>
        <form onSubmit={saveWebhook} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Repository</Label>
            {repoConfigs.length > 0 ? (
              <Select
                options={repoConfigs.map((r) => ({
                  value: r.repoId,
                  label: r.name,
                }))}
                placeholder="Select repository"
                onChange={(v) => setWebhookRepoId(v)}
              />
            ) : (
              <Input placeholder="Repository ID" onChange={(e) => setWebhookRepoId(e.target.value)} />
            )}
          </div>
          <div>
            <Label>Webhook Secret</Label>
            <Input
              type="password"
              placeholder="webhook-secret"
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm">Save Webhook Config</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

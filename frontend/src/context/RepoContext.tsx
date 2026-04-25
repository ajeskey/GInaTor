"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface RepoConfig {
  repoId: string;
  name?: string;
  providerType?: string;
}

interface RepoContextValue {
  repos: RepoConfig[];
  selectedRepo: string;
  setSelectedRepo: (id: string) => void;
  loading: boolean;
}

const RepoContext = createContext<RepoContextValue>({
  repos: [],
  selectedRepo: "",
  setSelectedRepo: () => {},
  loading: true,
});

export function RepoProvider({ children }: { children: ReactNode }) {
  const [repos, setRepos] = useState<RepoConfig[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/repos", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => {
        const configs: RepoConfig[] = Array.isArray(data)
          ? data
          : data.repoConfigs || [];
        setRepos(configs);
        if (configs.length > 0 && !selectedRepo) {
          setSelectedRepo(configs[0].repoId);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RepoContext.Provider value={{ repos, selectedRepo, setSelectedRepo, loading }}>
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo() {
  return useContext(RepoContext);
}

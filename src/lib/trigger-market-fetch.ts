const WORKFLOW_FILE = "fetch-market.yml";

export function isWorkflowDispatchConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_GITHUB_REPO &&
      import.meta.env.VITE_GITHUB_DISPATCH_TOKEN,
  );
}

export async function dispatchMarketFetchWorkflow(): Promise<void> {
  const repo = import.meta.env.VITE_GITHUB_REPO;
  const token = import.meta.env.VITE_GITHUB_DISPATCH_TOKEN;
  const ref = import.meta.env.VITE_GITHUB_REF ?? "master";

  if (!repo || !token) {
    throw new Error(
      "Server fetch is not configured (missing VITE_GITHUB_REPO or VITE_GITHUB_DISPATCH_TOKEN).",
    );
  }

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    throw new Error("VITE_GITHUB_REPO must be in owner/repo format.");
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Failed to trigger fetch workflow (${response.status}): ${detail}`,
    );
  }
}

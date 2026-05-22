import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { getAccountToken, getAllAccounts } from "@/lib/github-accounts";
import { GITHUB_API } from "@/lib/github";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface WeekData {
  week: string;
  additions: number;
  deletions: number;
}

async function fetchRepoStats(
  token: string,
  owner: string,
  repo: string,
): Promise<WeekData[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/stats/code_frequency`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  // 202 means GitHub is still computing the stats
  if (res.status === 202) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = (await res.json()) as Array<[number, number, number]>;

  // Convert to WeekData format (last 12 weeks)
  const weeks: WeekData[] = [];
  const now = Math.floor(Date.now() / 1000);
  const twelveWeeksAgo = now - 12 * 7 * 24 * 60 * 60;

  for (const [timestamp, additions, deletions] of data) {
    if (timestamp >= twelveWeeksAgo) {
      const date = new Date(timestamp * 1000);
      weeks.push({
        week: date.toISOString().split("T")[0],
        additions,
        deletions: Math.abs(deletions),
      });
    }
  }

  return weeks;
}

async function getUserTopRepos(token: string, githubLogin: string) {
  const res = await fetch(
    `${GITHUB_API}/users/${githubLogin}/repos?sort=updated&per_page=5&type=owner`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error("GitHub API error");
  }

  const repos = (await res.json()) as Array<{
    name: string;
    owner: { login: string };
  }>;

  return repos.slice(0, 3).map((r) => ({
    name: r.name,
    owner: r.owner.login,
  }));
}

async function getGithubLoginForAccount(
  userId: string,
  accountGithubId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("user_github_accounts")
    .select("github_login")
    .eq("user_id", userId)
    .eq("github_id", accountGithubId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.github_login as string;
}

function aggregateWeeks(allWeeks: WeekData[][]): {
  weeks: WeekData[];
  isComputing: boolean;
} {
  const weekMap = new Map<string, { additions: number; deletions: number }>();
  let hasEmptyResponse = false;

  for (const weeks of allWeeks) {
    if (weeks.length === 0) {
      hasEmptyResponse = true;
      continue;
    }

    for (const week of weeks) {
      const existing = weekMap.get(week.week) || {
        additions: 0,
        deletions: 0,
      };
      weekMap.set(week.week, {
        additions: existing.additions + week.additions,
        deletions: existing.deletions + week.deletions,
      });
    }
  }

  const sorted = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { additions, deletions }]) => ({
      week,
      additions,
      deletions,
    }));

  return {
    weeks: sorted,
    isComputing: hasEmptyResponse && sorted.length === 0,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = req.nextUrl.searchParams.get("accountId");
  const bypassCache = isMetricsCacheBypassed(req);

  try {
    if (!accountId) {
      return withMetricsCache(
        {
          bypass: bypassCache,
          key: metricsCacheKey(session.githubLogin, "diffTrend", {
            accountId: session.githubLogin,
          }),
          ttlSeconds: METRICS_CACHE_TTL_SECONDS.diffTrend,
        },
        async () => {
          const repos = await getUserTopRepos(
            session.accessToken,
            session.githubLogin,
          );

          const repoStats = await Promise.all(
            repos.map((repo) =>
              fetchRepoStats(session.accessToken, repo.owner, repo.name),
            ),
          );

          const { weeks, isComputing } = aggregateWeeks(repoStats);

          return {
            weeks: weeks.length > 0 ? weeks : [],
            isComputing,
            repoCount: repos.length,
          };
        },
      ).then((result) => Response.json(result));
    }

    // Handle multiple accounts
    if (!session.githubId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("github_id", session.githubId)
      .single();

    if (!userRow) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (accountId === "combined") {
      return withMetricsCache(
        {
          bypass: bypassCache,
          key: metricsCacheKey(userRow.id, "diffTrend", {
            accountId: "combined",
          }),
          ttlSeconds: METRICS_CACHE_TTL_SECONDS.diffTrend,
        },
        async () => {
          const accounts = await getAllAccounts(
            {
              token: session.accessToken,
              githubId: session.githubId,
              githubLogin: session.githubLogin,
            },
            userRow.id,
          );

          const allRepoStats: WeekData[][] = [];

          for (const account of accounts) {
            try {
              const repos = await getUserTopRepos(
                account.token,
                account.githubLogin,
              );
              const repoStats = await Promise.all(
                repos.map((repo) =>
                  fetchRepoStats(account.token, repo.owner, repo.name),
                ),
              );
              allRepoStats.push(...repoStats);
            } catch {
              // Skip this account if it fails
            }
          }

          const { weeks, isComputing } = aggregateWeeks(allRepoStats);

          return {
            weeks: weeks.length > 0 ? weeks : [],
            isComputing,
            repoCount: accounts.length,
          };
        },
      ).then((result) => Response.json(result));
    }

    const token =
      accountId === session.githubId
        ? session.accessToken
        : await getAccountToken(userRow.id, accountId);

    if (!token) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    const githubLogin =
      accountId === session.githubId
        ? session.githubLogin
        : await getGithubLoginForAccount(userRow.id, accountId);

    if (!githubLogin) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    return withMetricsCache(
      {
        bypass: bypassCache,
        key: metricsCacheKey(userRow.id, "diffTrend", { accountId }),
        ttlSeconds: METRICS_CACHE_TTL_SECONDS.diffTrend,
      },
      async () => {
        const repos = await getUserTopRepos(token, githubLogin);
        const repoStats = await Promise.all(
          repos.map((repo) => fetchRepoStats(token, repo.owner, repo.name)),
        );

        const { weeks, isComputing } = aggregateWeeks(repoStats);

        return {
          weeks: weeks.length > 0 ? weeks : [],
          isComputing,
          repoCount: repos.length,
        };
      },
    ).then((result) => Response.json(result));
  } catch {
    return Response.json(
      { error: "Failed to fetch diff trend data" },
      { status: 502 },
    );
  }
}

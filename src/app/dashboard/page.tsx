"use client";

import { useEffect, useState } from "react";
import ContributionGraph from "@/components/ContributionGraph";
import ContributionHeatmap from "@/components/ContributionHeatmap";
import PRMetrics from "@/components/PRMetrics";
import PRBreakdownChart from "@/components/PRBreakdownChart";
import GoalTracker from "@/components/GoalTracker";
import DashboardHeader from "@/components/DashboardHeader";
import StreakTracker from "@/components/StreakTracker";
import TopRepos from "@/components/TopRepos";
import PinnedRepos from "@/components/PinnedRepos";
import LanguageBreakdown from "@/components/LanguageBreakdown";
import CommitTimeChart from "@/components/CommitTimeChart";
import IssueMetrics from "@/components/IssueMetrics";
import StreakAtRiskBanner from "@/components/StreakAtRiskBanner";
import FriendComparison from "@/components/FriendComparison";
import WeeklySummaryCard from "@/components/WeeklySummaryCard";
import ExportButton from "@/components/ExportButton";
import PersonalRecords from "@/components/PersonalRecords";
import DiffTrendChart from "@/components/DiffTrendChart";

const DEFAULT_WIDGET_PREFS: Record<string, boolean> = {
  contributionGraph: true,
  streakTracker: true,
  prMetrics: true,
  topRepos: true,
  languageBreakdown: true,
  goalTracker: true,
  ciAnalytics: true,
  issuesTracker: true,
  friendComparison: true,
};

export default function DashboardPage() {
  const [widgetPrefs, setWidgetPrefs] = useState<Record<
    string,
    boolean
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch("/api/user/settings");
        if (res.ok) {
          const data = await res.json();
          setWidgetPrefs(data.user_widget_prefs || DEFAULT_WIDGET_PREFS);
        } else {
          // Fallback to showing all widgets if fetch fails
          setWidgetPrefs(DEFAULT_WIDGET_PREFS);
        }
      } catch (error) {
        console.error("Failed to load widget preferences:", error);
        // Fallback: show all widgets on error
        setWidgetPrefs(DEFAULT_WIDGET_PREFS);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, []);

  // Show dashboard while loading (with all widgets visible by default)
  const prefs = widgetPrefs || DEFAULT_WIDGET_PREFS;

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 text-[var(--foreground)] transition-colors">
      <DashboardHeader />
      <div className="mb-6 flex justify-end">
        <ExportButton />
      </div>
      <StreakAtRiskBanner />

      <WeeklySummaryCard />

      <div className="mb-6">
        <PersonalRecords />
      </div>

      {/* Row 1: Contribution graph + Streak + Friend Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {prefs.contributionGraph && (
            <>
              <ContributionGraph />
              <div className="mt-6">
                <ContributionHeatmap />
              </div>
              <div className="mt-6">
                <DiffTrendChart />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {prefs.streakTracker && <StreakTracker />}
          {prefs.friendComparison && <FriendComparison />}
        </div>
      </div>

      {/* Row 2: PR metrics, PR breakdown & Time Chart */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {prefs.prMetrics && <PRMetrics />}
        {prefs.ciAnalytics && <PRBreakdownChart />}
        {prefs.ciAnalytics && <CommitTimeChart />}
      </div>

      {/* Row 3: Issue metrics */}
      {prefs.issuesTracker && (
        <div className="mt-6">
          <IssueMetrics />
        </div>
      )}

      {/* Row 4: Pinned repositories */}
      <div className="mt-6">
        <PinnedRepos />
      </div>

      {/* Row 5: Top repos + Language breakdown + Goal tracker */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {prefs.topRepos && <TopRepos />}
        {prefs.languageBreakdown && <LanguageBreakdown />}
        {prefs.goalTracker && <GoalTracker />}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { UserSettings } from "@/app/api/user/settings/route";

const WIDGET_CONFIG = [
  {
    id: "contributionGraph",
    label: "Contribution Graph",
    description: "Daily contribution activity",
  },
  {
    id: "streakTracker",
    label: "Streak Tracker",
    description: "Commit streak tracking",
  },
  {
    id: "prMetrics",
    label: "PR Metrics",
    description: "Pull request analytics",
  },
  {
    id: "topRepos",
    label: "Top Repos",
    description: "Most active repositories",
  },
  {
    id: "languageBreakdown",
    label: "Language Breakdown",
    description: "Programming language distribution",
  },
  {
    id: "goalTracker",
    label: "Goal Tracker",
    description: "Personal contribution goals",
  },
  {
    id: "ciAnalytics",
    label: "CI Analytics",
    description: "Continuous integration metrics",
  },
  {
    id: "issuesTracker",
    label: "Issues Tracker",
    description: "Issue management metrics",
  },
  {
    id: "friendComparison",
    label: "Friend Comparison",
    description: "Compare with friends",
  },
];

interface DashboardWidgetSettingsProps {
  settings: UserSettings;
  onUpdate: (prefs: Record<string, boolean>) => Promise<void>;
}

export default function DashboardWidgetSettings({
  settings,
  onUpdate,
}: DashboardWidgetSettingsProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    settings.user_widget_prefs || {},
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(settings.user_widget_prefs || {});
  }, [settings]);

  const handleToggle = async (widgetId: string) => {
    const newPrefs = {
      ...prefs,
      [widgetId]: !prefs[widgetId],
    };

    setPrefs(newPrefs);
    setSaveError(null);
    setSaving(true);

    try {
      await onUpdate(newPrefs);
    } catch (error) {
      setSaveError("Failed to save preferences");
      // Revert change
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  const visibleCount = Object.values(prefs).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <h2 className="text-lg font-semibold text-[var(--card-foreground)] mb-2">
        Dashboard Widgets
      </h2>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Customize which widgets appear on your dashboard. You have{" "}
        {visibleCount} of {WIDGET_CONFIG.length} widgets visible.
      </p>

      {saveError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {saveError}
        </div>
      )}

      <div className="space-y-3">
        {WIDGET_CONFIG.map((widget) => (
          <div
            key={widget.id}
            className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--control)] p-4 hover:border-[var(--accent)]/50 transition-colors"
          >
            <div className="flex-1">
              <h3 className="font-medium text-[var(--card-foreground)]">
                {widget.label}
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {widget.description}
              </p>
            </div>

            <button
              onClick={() => handleToggle(widget.id)}
              disabled={saving}
              className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--background)] ${
                prefs[widget.id]
                  ? "bg-[var(--accent)]"
                  : "bg-[var(--card-muted)]"
              } ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              type="button"
              aria-label={`Toggle ${widget.label}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs[widget.id] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--muted-foreground)] mt-6">
        Changes are applied immediately. Newly added widgets default to visible.
      </p>
    </div>
  );
}

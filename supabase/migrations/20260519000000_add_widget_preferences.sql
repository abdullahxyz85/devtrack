-- Add widget preferences to users table
-- This file adds a JSONB column to store widget visibility preferences

alter table users
add column if not exists user_widget_prefs jsonb default jsonb_build_object(
  'contributionGraph', true,
  'streakTracker', true,
  'prMetrics', true,
  'topRepos', true,
  'languageBreakdown', true,
  'goalTracker', true,
  'ciAnalytics', true,
  'issuesTracker', true,
  'friendComparison', true
);

-- Add comment for documentation
comment on column users.user_widget_prefs is 'JSON object storing widget visibility preferences (true = visible, false = hidden)';

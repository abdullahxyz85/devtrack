import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side only — use in API routes, never import in client components.
// Service role bypasses RLS; auth is enforced by getServerSession checks.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

interface User {
  id: string;
  github_id: string;
  github_login: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Look up a user by GitHub username only if their profile is public.
 * Returns the user row if found and is_public is true, otherwise null.
 */
export async function getUserByUsername(
  username: string,
): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,github_id,github_login,is_public,created_at,updated_at")
    .eq("github_login", username)
    .eq("is_public", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows found
      return null;
    }
    console.error("Error fetching user:", error);
    return null;
  }

  return data as User;
}

/**
 * Update the is_public flag for a user.
 */
export async function updateUserPublicFlag(
  userId: string,
  isPublic: boolean,
): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ is_public: isPublic })
    .eq("id", userId)
    .select("id,github_id,github_login,is_public,created_at,updated_at")
    .single();

  if (error) {
    console.error("Error updating user public flag:", error);
    return null;
  }

  return data as User;
}

/**
 * Ensure user exists in database. Creates if not found.
 * Call this when user first logs in or accesses protected routes.
 */
export async function ensureUserExists(
  githubId: string,
  githubLogin: string,
): Promise<User | null> {
  try {
    // Try to find existing user
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id,github_id,github_login,is_public,created_at,updated_at")
      .eq("github_id", githubId)
      .single();

    // If user exists, return it
    if (existingUser) {
      return existingUser as User;
    }

    // If not found (PGRST116 error), create new user
    if (fetchError?.code === "PGRST116") {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert([
          {
            github_id: githubId,
            github_login: githubLogin,
            is_public: false,
            user_widget_prefs: {
              contributionGraph: true,
              streakTracker: true,
              prMetrics: true,
              topRepos: true,
              languageBreakdown: true,
              goalTracker: true,
              ciAnalytics: true,
              issuesTracker: true,
              friendComparison: true,
            },
          },
        ])
        .select("id,github_id,github_login,is_public,created_at,updated_at")
        .single();

      if (createError) {
        console.error("Error creating user:", createError);
        return null;
      }

      return newUser as User;
    }

    // Other error
    if (fetchError) {
      console.error("Error fetching user:", fetchError);
    }
    return null;
  } catch (error) {
    console.error("Unexpected error in ensureUserExists:", error);
    return null;
  }
}

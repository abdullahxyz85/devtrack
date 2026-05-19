import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  supabaseAdmin,
  updateUserPublicFlag,
  ensureUserExists,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export interface UserSettings {
  id: string;
  github_login: string;
  is_public: boolean;
  user_widget_prefs: Record<string, boolean>;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.githubId || !session?.githubLogin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure user exists in database (create if first login)
    const ensured = await ensureUserExists(
      session.githubId,
      session.githubLogin,
    );
    if (!ensured) {
      console.warn("Failed to ensure user exists for:", session.githubId);
    }

    // Fetch user from Supabase
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, github_login, is_public, user_widget_prefs")
      .eq("github_id", session.githubId)
      .single();

    if (error) {
      console.error("Error fetching user settings:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return NextResponse.json(
        { error: "Failed to fetch user settings" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Unexpected error in GET settings:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.githubId || !session?.githubLogin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure user exists in database (create if first login)
  await ensureUserExists(session.githubId, session.githubLogin);

  // Get user ID from Supabase
  const { data: user, error: fetchError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("github_id", session.githubId)
    .single();

  if (fetchError || !user) {
    console.error("Error fetching user:", fetchError);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Parse request body
  let body: {
    is_public?: boolean;
    user_widget_prefs?: Record<string, boolean>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { is_public, user_widget_prefs } = body;

  // Build update object
  const updates: {
    is_public?: boolean;
    user_widget_prefs?: Record<string, boolean>;
  } = {};

  if (typeof is_public === "boolean") {
    updates.is_public = is_public;
  }

  if (user_widget_prefs && typeof user_widget_prefs === "object") {
    updates.user_widget_prefs = user_widget_prefs;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  // Update user settings
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select("id, github_login, is_public, user_widget_prefs")
    .single();

  if (updateError) {
    console.error("Error updating settings:", updateError);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }

  return NextResponse.json(updated);
}

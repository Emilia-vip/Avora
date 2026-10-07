import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PublicError } from "./http.ts";

/** Calls per user and day. Override per function with e.g. AI_DAILY_LIMIT_SUGGEST_OUTFIT=200. */
const DEFAULT_LIMITS: Record<string, number> = {
  "analyze-clothing": 60,
  "cutout-clothing": 60,
  "suggest-outfit": 100,
};

/**
 * Counts one AI call against the user's daily quota (table `ai_usage`, see backend/supabase/schema.sql)
 * and throws 429 when it is used up. If the quota table is missing the call is allowed and logged,
 * so the app keeps working before schema.sql has been run.
 */
export async function consumeDailyQuota(supabase: SupabaseClient, userId: string, fn: string) {
  const envKey = `AI_DAILY_LIMIT_${fn.toUpperCase().replace(/-/g, "_")}`;
  const limit = Number(Deno.env.get(envKey) ?? DEFAULT_LIMITS[fn] ?? 50);

  const { data, error } = await supabase.rpc("consume_ai_quota", {
    p_user_id: userId,
    p_function: fn,
    p_limit: limit,
  });

  if (error) {
    console.error(`ai quota check failed for ${fn}, allowing call:`, error.message);
    return;
  }
  if (data === false) {
    throw new PublicError("Du har använt dagens AI-anrop. Försök igen i morgon.", 429);
  }
}

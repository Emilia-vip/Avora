import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { PublicError } from "./http.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/** Returns a service-role client and the user behind the request's access token, or throws 401. */
export async function requireUser(request: Request): Promise<{ supabase: SupabaseClient; user: User }> {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY saknas.");
  }

  const accessToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new PublicError("Inloggning krävs", 401);

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new PublicError("Inloggning krävs", 401);

  return { supabase, user: data.user };
}

/** Storage paths are `<userId>/...`; anything else belongs to someone else. */
export function assertOwnPath(path: string, user: User) {
  if (!path.startsWith(`${user.id}/`) || path.includes("..")) {
    throw new PublicError("Du saknar åtkomst till bilden", 403);
  }
}

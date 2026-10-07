import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { handle, jsonResponse } from "../_shared/http.ts";

const BUCKET = "wardrobe-images";
const PAGE = 1000;

/**
 * Permanently deletes the signed-in user: every photo in their storage folder, then the auth user.
 * Rows in clothing_items and ai_usage go with it through `on delete cascade`.
 */
serve(handle("delete-account", async (request) => {
  const { supabase, user } = await requireUser(request);

  // Always list from offset 0: each removed page shifts the next one up.
  for (;;) {
    const { data: files, error } = await supabase.storage.from(BUCKET).list(user.id, { limit: PAGE });
    if (error) throw error;
    // Entries without an id are sub-folders, which remove() can't delete; skipping them avoids looping forever.
    const paths = (files ?? []).filter((file) => file.id).map((file) => `${user.id}/${file.name}`);
    if (!paths.length) break;

    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) throw removeError;
    if (files!.length < PAGE) break;
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) throw deleteError;

  return jsonResponse({ deleted: true });
}));

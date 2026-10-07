import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { generateJson, modelList } from "../_shared/gemini.ts";
import { handle, jsonResponse, PublicError, readJson } from "../_shared/http.ts";
import { consumeDailyQuota } from "../_shared/rate-limit.ts";

const geminiModels = modelList(Deno.env.get("GEMINI_MODEL"), [
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-flash-latest",
]);

const suggestionSchema = {
  type: "object",
  properties: {
    itemIds: { type: "array", items: { type: "string" } },
    title: { type: "string" },
    reason: { type: "string" },
    matchPercent: { type: "integer" },
  },
  required: ["itemIds", "title", "reason", "matchPercent"],
};

serve(handle("suggest-outfit", async (request) => {
  const body = await readJson<{ wish?: string; weather?: string | null; gender?: string | null }>(request);
  const wish = body.wish?.trim().slice(0, 300);
  if (!wish) throw new PublicError("Describe what the outfit is for.");
  const weather = body.weather?.trim().slice(0, 200) || null;

  const { supabase, user } = await requireUser(request);

  const metaGender = typeof user.user_metadata?.gender === "string" ? user.user_metadata.gender : null;
  const gender = normalizeGender(body.gender ?? metaGender);

  const { data: items, error } = await supabase
    .from("clothing_items")
    .select("id, name, brand, category, color, pattern, material, style, season")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  if (!items?.length) throw new PublicError("Your wardrobe is empty. Add some clothes first.");

  await consumeDailyQuota(supabase, user.id, "suggest-outfit");

  const suggestion = await suggestOutfit(wish, items, weather, gender);
  const allowed = new Set(items.map((item) => item.id));
  const itemIds = suggestion.itemIds.filter((id) => allowed.has(id));

  if (itemIds.length < 2) {
    throw new PublicError("The AI couldn't put together at least two pieces from your wardrobe.", 422);
  }

  return jsonResponse({
    suggestion: {
      ...suggestion,
      itemIds,
      matchPercent: Math.max(50, Math.min(99, suggestion.matchPercent)),
    },
  });
}));

async function suggestOutfit(
  wish: string,
  items: Array<Record<string, unknown>>,
  weather: string | null,
  gender: "female" | "male" | "other" | null,
) {
  const wardrobe = items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    color: item.color,
    pattern: item.pattern,
    material: item.material,
    style: item.style,
    season: item.season,
  }));

  const genderHint = gender === "female"
    ? "The user identifies as a woman. Favour looks that feel natural in a women's wardrobe (e.g. dress, skirt, blouse) when those pieces exist, without forcing stereotypes."
    : gender === "male"
      ? "The user identifies as a man. Favour looks that feel natural in a men's wardrobe (e.g. shirt, trousers, sneakers) when those pieces exist, without forcing stereotypes."
      : "Gender is not given or neutral. Stick strictly to the pieces in the list and the request.";

  const parsed = await generateJson(geminiModels, {
    systemInstruction: {
      parts: [{
        text: `You are the stylist in a wardrobe app. Put together ONE outfit using ONLY the pieces in the list.
Rules:
- Only use ids that appear in the list.
- Pick 2-4 pieces that suit the request, each other, the weather and the user's profile (colour, style, pattern, occasion, temperature).
- ${genderHint}
- Cold or rain: favour a jacket/coat and closed shoes.
- Warm: avoid heavy jackets, pick lighter pieces.
- Never combine two tops. A dress replaces top + bottoms.
- At most one bold pattern. Neutral colours can carry a strong colour.
- Write title and reason in English and briefly mention the weather.`,
      }],
    },
    contents: [{
      parts: [{
        text: `Request: ${wish}\nWeather: ${weather ?? "unknown"}\nGender: ${gender ?? "not given"}\n\nWardrobe:\n${JSON.stringify(wardrobe)}`,
      }],
    }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: suggestionSchema,
    },
  });

  return {
    itemIds: Array.isArray(parsed.itemIds) ? parsed.itemIds.map((id) => String(id)) : [],
    title: String(parsed.title ?? "Suggested look"),
    reason: String(parsed.reason ?? ""),
    matchPercent: Number(parsed.matchPercent ?? 80),
  };
}

function normalizeGender(value?: string | null): "female" | "male" | "other" | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "female" || raw === "kvinna" || raw === "woman" || raw === "f") return "female";
  if (raw === "male" || raw === "man" || raw === "m") return "male";
  if (raw === "other" || raw === "annat" || raw.includes("non")) return "other";
  return null;
}

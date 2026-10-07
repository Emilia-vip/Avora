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
  if (!wish) throw new PublicError("Skriv ett önskemål för outfiten.");
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
  if (!items?.length) throw new PublicError("Garderoben är tom. Lägg till plagg först.");

  await consumeDailyQuota(supabase, user.id, "suggest-outfit");

  const suggestion = await suggestOutfit(wish, items, weather, gender);
  const allowed = new Set(items.map((item) => item.id));
  const itemIds = suggestion.itemIds.filter((id) => allowed.has(id));

  if (itemIds.length < 2) {
    throw new PublicError("AI:n kunde inte sätta ihop minst två plagg från garderoben.", 422);
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
    ? "Användaren identifierar sig som kvinna. Prioritera looks som känns naturliga i en kvinnlig garderob (t.ex. klänning, kjol, blus) när plaggen finns, utan att tvinga stereotyper."
    : gender === "male"
      ? "Användaren identifierar sig som man. Prioritera looks som känns naturliga i en manlig garderob (t.ex. skjorta, byxor, sneakers) när plaggen finns, utan att tvinga stereotyper."
      : "Kön är ej angivet eller neutralt. Håll dig strikt till plaggen i listan och önskemålet.";

  const parsed = await generateJson(geminiModels, {
    systemInstruction: {
      parts: [{
        text: `Du är stylist för en garderobs-app. Sätt ihop EN outfit från ENDAST plaggen i listan.
Regler:
- Använd bara id:n som finns i listan.
- Välj 2-4 plagg som passar både önskemålet, varandra, vädret och användarens könsprofil (färg, stil, mönster, tillfälle, temperatur).
- ${genderHint}
- Kallt eller regn: prioritera jacka/kappa och stängda skor.
- Varmt: undvik tunga jackor, välj lättare plagg.
- Blanda inte två överdelar. Klänning ersätter topp+byxa.
- Max ett starkt mönster. Neutrala färger får gärna bära upp starka färger.
- Svara på svenska i title och reason och nämn vädret kort.`,
      }],
    },
    contents: [{
      parts: [{
        text: `Önskemål: ${wish}\nVäder: ${weather ?? "okänt"}\nKön: ${gender ?? "ej angivet"}\n\nGarderob:\n${JSON.stringify(wardrobe)}`,
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
    title: String(parsed.title ?? "Föreslagen look"),
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

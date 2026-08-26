import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const geminiModels = [
  Deno.env.get("GEMINI_MODEL"),
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
].filter((model, index, list): model is string => Boolean(model) && list.indexOf(model) === index);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!geminiApiKey || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Edge Function secrets saknas.");
    }

    const body = await request.json() as { wish?: string };
    const wish = body.wish?.trim();
    if (!wish) {
      return jsonResponse({ error: "Skriv ett önskemål för outfiten." }, 400);
    }

    const accessToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: userData, error: userError } = accessToken
      ? await supabase.auth.getUser(accessToken)
      : { data: { user: null }, error: null };

    if (userError || !userData.user) {
      return jsonResponse({ error: "Inloggning krävs" }, 401);
    }

    const { data: items, error } = await supabase
      .from("clothing_items")
      .select("id, name, brand, category, color, pattern, material, style, season")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) throw error;
    if (!items?.length) {
      return jsonResponse({ error: "Garderoben är tom. Lägg till plagg först." }, 400);
    }

    const suggestion = await suggestOutfit(wish, items, geminiApiKey);
    const allowed = new Set(items.map((item) => item.id));
    const itemIds = suggestion.itemIds.filter((id) => allowed.has(id));

    if (itemIds.length < 2) {
      throw new Error("AI:n kunde inte sätta ihop minst två plagg från garderoben.");
    }

    return jsonResponse({
      suggestion: {
        ...suggestion,
        itemIds,
        matchPercent: Math.max(50, Math.min(99, suggestion.matchPercent)),
      },
    });
  } catch (error) {
    console.error("suggest-outfit error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Okänt fel" },
      500,
    );
  }
});

async function suggestOutfit(
  wish: string,
  items: Array<Record<string, unknown>>,
  apiKey: string,
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

  let lastError = "Inget svar från Gemini";

  for (const model of geminiModels) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `Du är stylist för en garderobs-app. Sätt ihop EN outfit från ENDAST plaggen i listan.
Regler:
- Använd bara id:n som finns i listan.
- Välj 2-4 plagg som passar både önskemålet och varandra (färg, stil, mönster, tillfälle).
- Blanda inte två överdelar. Klänning ersätter topp+byxa.
- Max ett starkt mönster. Neutrala färger får gärna bära upp starka färger.
- Svara på svenska i title och reason.`,
            }],
          },
          contents: [{
            parts: [{
              text: `Önskemål: ${wish}\n\nGarderob:\n${JSON.stringify(wardrobe)}`,
            }],
          }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
            responseSchema: suggestionSchema,
          },
        }),
      },
    );

    const raw = await response.text();
    if (!response.ok) {
      lastError = `Gemini API-fel (${model}, ${response.status}): ${raw.slice(0, 400)}`;
      continue;
    }

    const data = JSON.parse(raw);
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      lastError = `Inget analyssvar från Gemini (${model})`;
      continue;
    }

    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
        itemIds: unknown;
        title?: string;
        reason?: string;
        matchPercent?: number;
      };
      const itemIds = Array.isArray(parsed.itemIds)
        ? parsed.itemIds.map((id) => String(id))
        : [];
      return {
        itemIds,
        title: String(parsed.title ?? "Föreslagen look"),
        reason: String(parsed.reason ?? ""),
        matchPercent: Number(parsed.matchPercent ?? 80),
      };
    } catch {
      lastError = `Kunde inte tolka JSON-svar från Gemini: ${text.slice(0, 300)}`;
    }
  }

  throw new Error(lastError);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

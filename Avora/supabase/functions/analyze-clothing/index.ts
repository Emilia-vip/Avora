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

interface RequestBody {
  storagePath?: string;
  bucket?: string;
  imageBase64?: string;
  mediaType?: string;
}

interface ClothingAnalysis {
  category: string;
  colors: string[];
  pattern: string;
  material: string;
  style: string;
  season: string[];
  description: string;
}

const analysisSchema = {
  type: "object",
  properties: {
    category: { type: "string" },
    colors: { type: "array", items: { type: "string" } },
    pattern: { type: "string" },
    material: { type: "string" },
    style: { type: "string" },
    season: { type: "array", items: { type: "string" } },
    description: { type: "string" },
  },
  required: ["category", "colors", "pattern", "material", "style", "season", "description"],
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!geminiApiKey || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Edge Function secrets saknas. Lägg till GEMINI_API_KEY i Supabase.");
    }

    const body = (await request.json()) as RequestBody;
    const accessToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: userData, error: userError } = accessToken
      ? await supabase.auth.getUser(accessToken)
      : { data: { user: null }, error: null };

    if (userError || !userData.user) {
      return jsonResponse({ error: "Inloggning krävs" }, 401);
    }

    let imageBase64: string;
    let mediaType: string;

    if (body.imageBase64 && body.mediaType) {
      imageBase64 = stripDataUrl(body.imageBase64);
      mediaType = normalizeMediaType(body.mediaType);
    } else if (body.storagePath) {
      if (!body.storagePath.startsWith(`${userData.user.id}/`)) {
        return jsonResponse({ error: "Du saknar åtkomst till bilden" }, 403);
      }

      const bucket = body.bucket ?? "wardrobe-images";
      const { data, error } = await supabase.storage.from(bucket).download(body.storagePath);

      if (error || !data) {
        throw new Error(`Kunde inte hämta bild från storage: ${error?.message ?? "bild saknas"}`);
      }

      imageBase64 = base64Encode(new Uint8Array(await data.arrayBuffer()));
      mediaType = normalizeMediaType(data.type || "image/jpeg");
    } else {
      return jsonResponse({ error: "Måste ange antingen storagePath eller imageBase64" }, 400);
    }

    const analysis = await analyzeClothingImage(imageBase64, mediaType, geminiApiKey);
    return jsonResponse({ analysis });
  } catch (error) {
    console.error("analyze-clothing error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Okänt fel" },
      500,
    );
  }
});

async function analyzeClothingImage(
  imageBase64: string,
  mediaType: string,
  apiKey: string,
): Promise<ClothingAnalysis> {
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
              text:
                "Du analyserar klädesplagg från bilder åt en garderobs-app. Titta på plagget, inte personen eller bakgrunden. Gissa material utifrån ytans utseende. Om bilden inte visar ett tydligt plagg, sätt category till okänt. Skriv alla texter på svenska. Svara bara med JSON.",
            }],
          },
          contents: [{
            parts: [
              { inlineData: { mimeType: mediaType, data: imageBase64 } },
              { text: "Analysera plagget: färger, mönster, material och stil." },
            ],
          }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: analysisSchema,
          },
        }),
      },
    );

    const raw = await response.text();
    if (!response.ok) {
      lastError = `Gemini API-fel (${model}, ${response.status}): ${raw.slice(0, 400)}`;
      console.error(lastError);
      continue;
    }

    const data = JSON.parse(raw);
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      lastError = `Inget analyssvar från Gemini (${model}, ${data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? "tomt svar"})`;
      continue;
    }

    try {
      return normalizeAnalysis(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch {
      lastError = `Kunde inte tolka JSON-svar från Gemini: ${text.slice(0, 300)}`;
    }
  }

  throw new Error(lastError);
}

function normalizeAnalysis(raw: Record<string, unknown>): ClothingAnalysis {
  const colors = Array.isArray(raw.colors)
    ? raw.colors.map((color) => String(color).trim()).filter(Boolean)
    : [];
  const season = Array.isArray(raw.season)
    ? raw.season.map((value) => String(value).trim()).filter(Boolean)
    : [];

  return {
    category: String(raw.category ?? "okänt").trim() || "okänt",
    colors: colors.length ? colors : ["okänd"],
    pattern: String(raw.pattern ?? "okänt").trim() || "okänt",
    material: String(raw.material ?? "okänt").trim() || "okänt",
    style: String(raw.style ?? "okänd").trim() || "okänd",
    season: season.length ? season : ["alla"],
    description: String(raw.description ?? "").trim(),
  };
}

function normalizeMediaType(value: string) {
  const type = value.toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (type.startsWith("image/")) return type.split(";")[0];
  return "image/jpeg";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripDataUrl(value: string) {
  const marker = "base64,";
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : value;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

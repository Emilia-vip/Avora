import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { assertOwnPath, requireUser } from "../_shared/auth.ts";
import { generateJson, modelList } from "../_shared/gemini.ts";
import { handle, jsonResponse, PublicError, readJson } from "../_shared/http.ts";
import { consumeDailyQuota } from "../_shared/rate-limit.ts";

const geminiModels = modelList(Deno.env.get("GEMINI_MODEL"), [
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-flash-latest",
]);

/** ~7.5 MB image; the app shrinks photos to 1200px wide, so anything bigger is not from the app. */
const MAX_BASE64_LENGTH = 10_000_000;

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

serve(handle("analyze-clothing", async (request) => {
  const body = await readJson<RequestBody>(request);
  const { supabase, user } = await requireUser(request);

  let imageBase64: string;
  let mediaType: string;

  if (body.imageBase64 && body.mediaType) {
    imageBase64 = stripDataUrl(body.imageBase64);
    if (imageBase64.length > MAX_BASE64_LENGTH) throw new PublicError("Bilden är för stor.", 413);
    mediaType = normalizeMediaType(body.mediaType);
  } else if (body.storagePath) {
    assertOwnPath(body.storagePath, user);

    const bucket = body.bucket ?? "wardrobe-images";
    const { data, error } = await supabase.storage.from(bucket).download(body.storagePath);
    if (error || !data) throw error ?? new Error("Bilden saknas i storage.");

    imageBase64 = base64Encode(new Uint8Array(await data.arrayBuffer()));
    mediaType = normalizeMediaType(data.type || "image/jpeg");
  } else {
    throw new PublicError("Måste ange antingen storagePath eller imageBase64");
  }

  await consumeDailyQuota(supabase, user.id, "analyze-clothing");

  const raw = await generateJson(geminiModels, {
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
  });

  return jsonResponse({ analysis: normalizeAnalysis(raw) });
}));

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

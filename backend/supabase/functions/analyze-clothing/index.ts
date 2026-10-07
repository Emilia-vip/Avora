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
    if (imageBase64.length > MAX_BASE64_LENGTH) throw new PublicError("The image is too large.", 413);
    mediaType = normalizeMediaType(body.mediaType);
  } else if (body.storagePath) {
    assertOwnPath(body.storagePath, user);

    // Fixed bucket: the service-role client must never read a bucket the app picks.
    const { data, error } = await supabase.storage.from("wardrobe-images").download(body.storagePath);
    if (error || !data) throw error ?? new Error("The image is missing from storage.");

    imageBase64 = base64Encode(new Uint8Array(await data.arrayBuffer()));
    mediaType = normalizeMediaType(data.type || "image/jpeg");
  } else {
    throw new PublicError("Provide either storagePath or imageBase64.");
  }

  await consumeDailyQuota(supabase, user.id, "analyze-clothing");

  const raw = await generateJson(geminiModels, {
    systemInstruction: {
      parts: [{
        text:
          "You analyse clothing from photos for a wardrobe app. Look at the garment, not the person or the background. Guess the material from how the surface looks. If the photo does not show a clear garment, set category to unknown. Write all text in English. In description, give a short garment name of 2-5 words, e.g. \"Navy wool blazer\". Answer with JSON only.",
      }],
    },
    contents: [{
      parts: [
        { inlineData: { mimeType: mediaType, data: imageBase64 } },
        { text: "Analyse the garment: colours, pattern, material, style and the seasons it suits." },
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
    category: String(raw.category ?? "unknown").trim() || "unknown",
    colors: colors.length ? colors : ["unknown"],
    pattern: String(raw.pattern ?? "unknown").trim() || "unknown",
    material: String(raw.material ?? "unknown").trim() || "unknown",
    style: String(raw.style ?? "unknown").trim() || "unknown",
    season: season.length ? season : ["all"],
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

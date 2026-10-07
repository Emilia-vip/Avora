import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { decodeBase64, encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { assertOwnPath, requireUser } from "../_shared/auth.ts";
import { callGemini, errorMessage, modelList, requireGeminiKey, responseText, unavailableError } from "../_shared/gemini.ts";
import { handle, jsonResponse, PublicError, readJson } from "../_shared/http.ts";
import { consumeDailyQuota } from "../_shared/rate-limit.ts";

// Optional: a dedicated background-removal service gives far cleaner edges than Gemini's outlines.
const removeBgApiKey = Deno.env.get("REMOVE_BG_API_KEY");
const geminiModels = modelList(Deno.env.get("GEMINI_SEGMENT_MODEL"), [
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.8-flash",
]);

const segmentPrompt = `Give the segmentation mask for the single main clothing item in this photo (a garment, shoe, bag or accessory).
Do not include the background, the floor, hangers, hands, skin or the body of a person wearing it.
Output a JSON list where each entry contains the 2D bounding box in the key "box_2d" as [ymin, xmin, ymax, xmax],
the outline in the key "mask" and a descriptive text label in the key "label".
The "mask" must be a polygon: a JSON array of [x, y] points, normalized to 0-1000 relative to the whole image,
tracing the garment's outer edge in order, with 40-120 points so sleeves, collars and hems are followed closely.
Never output the mask as RLE, base64 or any encoded string.`;

type Point = [number, number];
type Segment = { box_2d: number[]; mask: unknown; label?: string };

serve(handle("cutout-clothing", async (request) => {
  requireGeminiKey();
  const body = await readJson<{ storagePath?: string }>(request);
  // Fixed bucket: the service-role client must never read a bucket the app picks.
  const bucket = "wardrobe-images";
  const storagePath = body.storagePath?.trim();
  if (!storagePath) throw new PublicError("storagePath is missing.");

  const { supabase, user } = await requireUser(request);
  assertOwnPath(storagePath, user);

  const { data: file, error: downloadError } = await supabase.storage.from(bucket).download(storagePath);
  if (downloadError || !file) throw downloadError ?? new Error("Could not read the image.");

  await consumeDailyQuota(supabase, user.id, "cutout-clothing");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const cutoutPath = `${user.id}/${Date.now()}-cutout.png`;

  if (removeBgApiKey) {
    try {
      const png = await removeBackground(bytes, removeBgApiKey);
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(cutoutPath, png, { contentType: "image/png", upsert: false });
      if (uploadError) throw uploadError;
      return jsonResponse({ cutoutPath, label: null });
    } catch (error) {
      // Out of credits or service down: fall back to Gemini rather than failing.
      console.error("remove.bg failed, falling back to Gemini:", error);
    }
  }

  const segment = await segmentGarment(bytes, file.type || "image/jpeg");
  if (!segment) throw new PublicError("The AI couldn't find a garment in the photo.", 422);

  const photo = await Image.decode(bytes);
  const cutout = await cutOut(photo, segment);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(cutoutPath, await cutout.encode(), { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;

  return jsonResponse({ cutoutPath, label: segment.label ?? null });
}));

/** remove.bg returns the photo as a transparent PNG cropped to the garment. */
async function removeBackground(bytes: Uint8Array, apiKey: string) {
  const form = new FormData();
  form.append("image_file", new Blob([bytes.slice().buffer]), "photo.jpg");
  form.append("size", "auto");
  form.append("format", "png");
  form.append("crop", "true");
  form.append("crop_margin", "3%");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: form,
  });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw.slice(0, 200);
    try {
      message = JSON.parse(raw)?.errors?.[0]?.title ?? message;
    } catch {
      // Keep the raw text.
    }
    throw new Error(`remove.bg (${response.status}): ${message}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function segmentGarment(bytes: Uint8Array, mimeType: string) {
  const errors: string[] = [];
  const statuses: number[] = [];

  const image = encodeBase64(bytes);

  for (const model of geminiModels) {
    // Segmentation is most accurate with thinking turned (almost) off, but not every model accepts "minimal".
    const thinkingConfigs = model.startsWith("gemini-2.5")
      ? [{ thinkingBudget: 0 }]
      : [{ thinkingLevel: "minimal" }, { thinkingLevel: "low" }];
    let configIndex = 0;
    let busyRetries = 0;
    let raw = "";

    while (true) {
      const response = await requestSegmentation(model, image, mimeType, thinkingConfigs[configIndex]);
      raw = await response.text();
      if (response.ok) break;

      const message = errorMessage(raw);
      if (response.status === 400 && /thinking level/i.test(message) && configIndex + 1 < thinkingConfigs.length) {
        configIndex++;
        continue;
      }
      // Overloaded models usually recover within a couple of seconds.
      // A 429 that mentions quota will not clear up by waiting, so only retry plain overload/rate limits.
      const quotaExhausted = response.status === 429 && /quota/i.test(message);
      if ((response.status === 503 || response.status === 429) && !quotaExhausted && busyRetries < 3) {
        busyRetries++;
        await new Promise((resolve) => setTimeout(resolve, 2000 * busyRetries));
        continue;
      }
      statuses.push(response.status);
      errors.push(`${model} (${response.status}): ${message}`);
      raw = "";
      break;
    }
    if (!raw) continue;

    const text = responseText(raw);

    try {
      const parsed = JSON.parse(text);
      const list: Segment[] = Array.isArray(parsed) ? parsed : parsed?.boxes ?? parsed?.masks ?? [];
      const valid = list.filter((entry) => Array.isArray(entry?.box_2d) && entry.box_2d.length === 4 && entry.mask);
      if (!valid.length) return null;
      // The main garment is the biggest thing the model found.
      const best = valid.sort((a, b) => boxArea(b.box_2d) - boxArea(a.box_2d))[0];
      // A broken or truncated PNG mask is worth retrying with the next model rather than failing outright.
      if (typeof best.mask === "string" && !(await decodeMask(best.mask))) {
        errors.push(`${model}: masken gick inte att avkoda (${best.mask.slice(0, 40)}…)`);
        continue;
      }
      return best;
    } catch {
      errors.push(`${model}: kunde inte tolka svaret: ${String(text).slice(0, 200)}`);
    }
  }

  throw unavailableError(statuses, errors);
}

/** Crops the photo to the garment (with a little breathing room) and makes everything else transparent. */
async function cutOut(photo: Image, segment: Segment) {
  const W = photo.width;
  const H = photo.height;
  const [ymin, xmin, ymax, xmax] = segment.box_2d.map(Number);
  const box = {
    x0: clamp(Math.floor((xmin / 1000) * W), 0, W - 1),
    y0: clamp(Math.floor((ymin / 1000) * H), 0, H - 1),
    x1: clamp(Math.ceil((xmax / 1000) * W), 1, W),
    y1: clamp(Math.ceil((ymax / 1000) * H), 1, H),
  };
  const boxW = Math.max(1, box.x1 - box.x0);
  const boxH = Math.max(1, box.y1 - box.y0);

  const pad = Math.round(Math.max(boxW, boxH) * 0.03);
  const crop = {
    x: Math.max(0, box.x0 - pad),
    y: Math.max(0, box.y0 - pad),
    w: Math.min(W, box.x1 + pad) - Math.max(0, box.x0 - pad),
    h: Math.min(H, box.y1 + pad) - Math.max(0, box.y0 - pad),
  };

  let alpha: Float32Array;
  if (typeof segment.mask === "string") {
    alpha = await maskFromPng(segment.mask, box, crop);
  } else {
    const rings = toRings(segment.mask);
    if (!rings.length) throw new Error("The AI returned no valid outline.");
    alpha = rasterize(rings.map((ring) => ring.map((p) => toPixel(p, rings, segment.box_2d, box, W, H))), crop);
  }

  const out = new Image(crop.w, crop.h);
  const src = photo.bitmap;
  const dst = out.bitmap;
  for (let y = 0; y < crop.h; y++) {
    for (let x = 0; x < crop.w; x++) {
      const s = ((crop.y + y) * W + (crop.x + x)) * 4;
      const d = (y * crop.w + x) * 4;
      dst[d] = src[s];
      dst[d + 1] = src[s + 1];
      dst[d + 2] = src[s + 2];
      dst[d + 3] = Math.round(alpha[y * crop.w + x] * 255);
    }
  }
  return out;
}

/** Older Gemini models return a base64 PNG probability map sized to the bounding box. */
async function maskFromPng(dataUrl: string, box: { x0: number; y0: number; x1: number; y1: number }, crop: Crop) {
  const mask = await decodeMask(dataUrl);
  if (!mask) throw new Error("The AI returned an unreadable mask.");
  return alphaFromBoxMask(mask, box, crop);
}

/** Stretches a mask image over the bounding box and turns it into crop-sized alpha. */
function alphaFromBoxMask(mask: Image, box: Box, crop: Crop) {
  mask.resize(box.x1 - box.x0, box.y1 - box.y0);
  const alpha = new Float32Array(crop.w * crop.h);
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const value = mask.bitmap[((y - box.y0) * mask.width + (x - box.x0)) * 4] / 255;
      // Soft threshold around 0.5 keeps edges smooth without a halo.
      alpha[(y - crop.y) * crop.w + (x - crop.x)] = clamp((value - 0.35) / 0.3, 0, 1);
    }
  }
  return alpha;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
/**
 * Gemini's PNG masks are not always clean base64: the data-URL prefix varies, the string may contain
 * line breaks, use the URL-safe alphabet or lack padding. Returns null if it still is not a readable image.
 */
async function decodeMask(value: string) {
  const base64 = value
    .trim()
    .replace(/^data:[^,]*,/, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/=+$/, "");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    return await Image.decode(decodeBase64(padded)) as Image;
  } catch {
    return null;
  }
}

/** Newer Gemini models return polygons ([x, y] pairs, 0–1000). Accepts one ring or several. */
function toRings(mask: unknown): Point[][] {
  if (!Array.isArray(mask) || !mask.length) return [];
  const isPoint = (value: unknown) => Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === "number");
  const rings = isPoint(mask[0]) ? [mask] : mask;
  return rings
    .filter((ring): ring is Point[] => Array.isArray(ring) && ring.every(isPoint))
    .filter((ring) => ring.length >= 3);
}

/**
 * The docs describe the polygon as 0–1000 "inside the bounding box", which can mean either
 * image-relative or box-relative coordinates. If the points already sit inside box_2d they are
 * image-relative; otherwise treat them as relative to the box.
 */
function toPixel(
  [x, y]: Point,
  rings: Point[][],
  box2d: number[],
  box: { x0: number; y0: number; x1: number; y1: number },
  W: number,
  H: number,
): Point {
  if (imageRelative(rings, box2d)) return [(x / 1000) * W, (y / 1000) * H];
  return [box.x0 + (x / 1000) * (box.x1 - box.x0), box.y0 + (y / 1000) * (box.y1 - box.y0)];
}

const relativeCache = new WeakMap<Point[][], boolean>();
function imageRelative(rings: Point[][], [ymin, xmin, ymax, xmax]: number[]) {
  const cached = relativeCache.get(rings);
  if (cached !== undefined) return cached;
  const points = rings.flat();
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const tolerance = 25;
  const result = Math.min(...xs) >= xmin - tolerance && Math.max(...xs) <= xmax + tolerance
    && Math.min(...ys) >= ymin - tolerance && Math.max(...ys) <= ymax + tolerance
    && Math.max(...xs) - Math.min(...xs) > (xmax - xmin) * 0.5;
  relativeCache.set(rings, result);
  return result;
}

type Crop = { x: number; y: number; w: number; h: number };

/** Even-odd polygon fill with 4× vertical supersampling and fractional horizontal coverage (anti-aliased edges). */
function rasterize(rings: Point[][], crop: Crop) {
  const alpha = new Float32Array(crop.w * crop.h);
  const samples = [0.125, 0.375, 0.625, 0.875];
  const edges = rings.flatMap((ring) => ring.map((a, i) => [a, ring[(i + 1) % ring.length]] as const));

  for (let row = 0; row < crop.h; row++) {
    const line = alpha.subarray(row * crop.w, (row + 1) * crop.w);
    for (const offset of samples) {
      const sy = crop.y + row + offset;
      const xs: number[] = [];
      for (const [[ax, ay], [bx, by]] of edges) {
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
          xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax) - crop.x);
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        addSpan(line, xs[i], xs[i + 1], 1 / samples.length);
      }
    }
  }
  return alpha;
}

function addSpan(line: Float32Array, start: number, end: number, weight: number) {
  const a = clamp(start, 0, line.length);
  const b = clamp(end, 0, line.length);
  if (b <= a) return;
  const first = Math.floor(a);
  const last = Math.min(Math.floor(b), line.length - 1);
  if (first === last) {
    line[first] += (b - a) * weight;
    return;
  }
  line[first] += (first + 1 - a) * weight;
  for (let x = first + 1; x < last; x++) line[x] += weight;
  if (last < line.length) line[last] += (b - last) * weight;
}

function requestSegmentation(
  model: string,
  image: string,
  mimeType: string,
  thinkingConfig: Record<string, unknown>,
) {
  return callGemini(model, {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: image } },
        { text: segmentPrompt },
      ],
    }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      thinkingConfig,
    },
  });
}

function boxArea([ymin, xmin, ymax, xmax]: number[]) {
  return Math.max(0, ymax - ymin) * Math.max(0, xmax - xmin);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

import { categorySlot, type ClothingSlot } from '@/lib/clothing-category';
import type { GenderValue } from '@/lib/gender';
import type { WeatherSnapshot } from '@/lib/weather';

export type WardrobeItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  color: string | null;
  pattern: string | null;
  material: string | null;
  style: string | null;
  season?: string | null;
  image: string | null;
  image_path?: string | null;
};

export type OutfitSuggestion = {
  items: WardrobeItem[];
  title: string;
  reason: string;
  matchPercent: number;
};

type Slot = ClothingSlot;

const NEUTRALS = [
  'svart', 'vit', 'beige', 'grå', 'gra', 'cream', 'kräm', 'navy', 'marin',
  'brun', 'khaki', 'camel', 'offwhite', 'ivory', 'black', 'white', 'grey', 'gray', 'brown',
  'off-white', 'charcoal',
];

export function matchOutfitFromWardrobe(
  items: WardrobeItem[],
  wish: string,
  weather?: WeatherSnapshot | null,
  gender?: GenderValue | null,
): OutfitSuggestion | null {
  if (items.length === 0) return null;

  const occasion = detectOccasion(wish);
  const ranked = [...items]
    .map((item) => ({ item, score: occasionScore(item, occasion, wish, weather, gender) }))
    .sort((left, right) => right.score - left.score);

  const bySlot = new Map<Slot, WardrobeItem[]>();
  for (const { item } of ranked) {
    const slot = categorySlot(item.category);
    if (!slot) continue;
    const list = bySlot.get(slot) ?? [];
    list.push(item);
    bySlot.set(slot, list);
  }

  const candidates: WardrobeItem[][] = [];
  const dresses = bySlot.get('dress') ?? [];
  const tops = bySlot.get('top') ?? [];
  const bottoms = bySlot.get('bottom') ?? [];
  const shoes = bySlot.get('shoes') ?? [];
  const jackets = bySlot.get('jacket') ?? [];
  const accessories = bySlot.get('accessory') ?? [];

  const take = <T,>(list: T[], count: number) => list.slice(0, count);

  if (occasion === 'evening' || occasion === 'formal') {
    for (const dress of take(dresses, 4)) {
      candidates.push(compact([dress, take(shoes, 1)[0], take(accessories, 1)[0]]));
    }
  }

  for (const top of take(tops, 5)) {
    for (const bottom of take(bottoms, 5)) {
      const base = [top, bottom];
      const shoe = bestCompanion(base, shoes);
      const jacket = wantsOuterwear(weather, occasion)
        ? bestCompanion([...base, shoe].filter(Boolean) as WardrobeItem[], jackets)
        : undefined;
      const accessory = bestCompanion([...base, shoe, jacket].filter(Boolean) as WardrobeItem[], accessories);
      candidates.push(compact([...base, shoe, jacket, accessory]));
    }
  }

  for (const dress of take(dresses, 4)) {
    const jacket = wantsOuterwear(weather, occasion) ? bestCompanion([dress], jackets) : undefined;
    candidates.push(compact([dress, bestCompanion([dress], shoes), jacket, bestCompanion([dress], accessories)]));
  }

  const unique = candidates
    .filter((outfit) => outfit.length >= 2)
    .map((outfit) => ({
      outfit,
      score: scoreOutfit(outfit, occasion, wish, weather, gender),
    }))
    .sort((left, right) => right.score - left.score);

  const winner = unique[0];
  if (!winner) {
    return {
      items: ranked.slice(0, Math.min(3, ranked.length)).map((entry) => entry.item),
      title: titleForOccasion(occasion, wish),
      reason: 'These are the pieces in your wardrobe that best match what you asked for.',
      matchPercent: 62,
    };
  }

  return {
    items: winner.outfit,
    title: titleForOccasion(occasion, wish),
    reason: explainOutfit(winner.outfit, occasion, weather),
    matchPercent: Math.max(68, Math.min(97, Math.round(winner.score))),
  };
}

function detectOccasion(wish: string) {
  const text = wish.toLowerCase();
  if (/(dejt|date|middag|dinner|kväll|evening|night|fest|party|bröllop|wedding)/.test(text)) return 'evening';
  if (/(jobb|work|\bjob\b|möte|meeting|kontor|office|intervju|interview|business|formell|formal)/.test(text)) return 'formal';
  if (/(träning|gym|sport|workout|löp|\brun|training)/.test(text)) return 'sport';
  if (/(sommar|summer|varm|warm|\bhot\b|strand|beach)/.test(text)) return 'summer';
  if (/(vinter|winter|kallt|cold|regn|rain|höst|autumn|\bfall\b)/.test(text)) return 'cold';
  return 'casual';
}

function titleForOccasion(occasion: ReturnType<typeof detectOccasion>, wish: string) {
  if (wish.trim().length > 2 && wish.trim().length < 28) {
    return wish.trim().charAt(0).toUpperCase() + wish.trim().slice(1);
  }
  switch (occasion) {
    case 'evening':
      return 'Evening look';
    case 'formal':
      return 'Work look';
    case 'sport':
      return 'Workout look';
    case 'summer':
      return 'Summer look';
    case 'cold':
      return 'Warm look';
    default:
      return 'Everyday look';
  }
}


function wantsOuterwear(weather: WeatherSnapshot | null | undefined, occasion: ReturnType<typeof detectOccasion>) {
  if (weather?.isRainy || weather?.isCold) return true;
  return occasion === 'cold' || occasion === 'formal';
}

function weatherScore(item: WardrobeItem, weather?: WeatherSnapshot | null) {
  if (!weather) return 0;
  const slot = categorySlot(item.category);
  const haystack = `${item.name} ${item.material} ${item.category} ${item.style}`.toLowerCase();
  let score = 0;
  if (weather.isCold && (slot === 'jacket' || /(ylle|ull|stickat|kappa|täck|hoodie|wool|knit|coat|puffer|fleece)/.test(haystack))) score += 16;
  if (weather.isCold && /(linne|short|sandal|tank)/.test(haystack)) score -= 14;
  if (weather.isWarm && (slot === 'jacket' || /(kappa|ylle|täck|puffer|coat|wool)/.test(haystack))) score -= 14;
  if (weather.isWarm && /(linne|kort|short|sandal|bomull|tank|linen|cotton)/.test(haystack)) score += 10;
  if (weather.isRainy && slot === 'jacket') score += 14;
  if (weather.isRainy && /(sandal|mocka|suede)/.test(haystack)) score -= 16;
  return score;
}

function occasionScore(
  item: WardrobeItem,
  occasion: ReturnType<typeof detectOccasion>,
  wish: string,
  weather?: WeatherSnapshot | null,
  gender?: GenderValue | null,
) {
  let score = 10;
  const haystack = `${item.name} ${item.style} ${item.color} ${item.material} ${item.pattern} ${item.category}`.toLowerCase();
  for (const word of wish.toLowerCase().split(/\s+/).filter((part) => part.length > 3)) {
    if (haystack.includes(word)) score += 12;
  }

  const style = (item.style ?? '').toLowerCase();
  if (occasion === 'evening' && /(elegant|kväll|formell|fest|evening|formal|party|dressy)/.test(style + haystack)) score += 18;
  if (occasion === 'formal' && /(formell|formal|classic|kontor|office|business|minimal|tailor)/.test(style + haystack)) score += 18;
  if (occasion === 'sport' && /(sport|träning|athleisure|athletic|training)/.test(style + haystack)) score += 20;
  if (occasion === 'casual' && /(casual|street|vardag|everyday)/.test(style + haystack)) score += 10;
  if (occasion === 'summer' && /(linne|bomull|kort|sommar|linen|cotton|summer)/.test(haystack)) score += 12;
  if (occasion === 'cold' && /(ylle|stickat|kappa|jacka|ull|wool|knit|coat|jacket)/.test(haystack)) score += 12;
  score += weatherScore(item, weather);
  score += genderScore(item, gender);
  return score;
}

function genderScore(item: WardrobeItem, gender?: GenderValue | null) {
  if (!gender || gender === 'other') return 0;
  const slot = categorySlot(item.category);
  const haystack = `${item.name} ${item.category} ${item.style}`.toLowerCase();

  if (gender === 'female') {
    if (slot === 'dress' || /(klänning|kjol|blus|heels|klack|skirt|blouse)/.test(haystack)) return 8;
    if (/(kostymbyxa|fluga|necktie)/.test(haystack)) return -4;
  }

  if (gender === 'male') {
    if (slot === 'dress' || /(klänning|kjol|klack|heels|skirt)/.test(haystack)) return -10;
    if (/(skjorta|chino|kostym|sneaker|loafers|shirt|suit)/.test(haystack)) return 6;
  }

  return 0;
}

function bestCompanion(base: WardrobeItem[], options: WardrobeItem[]) {
  if (options.length === 0) return undefined;
  return [...options].sort((left, right) => harmony(base, right) - harmony(base, left))[0];
}

function scoreOutfit(
  outfit: WardrobeItem[],
  occasion: ReturnType<typeof detectOccasion>,
  wish: string,
  weather?: WeatherSnapshot | null,
  gender?: GenderValue | null,
) {
  const slots = outfit.map((item) => categorySlot(item.category));
  let score = 50;
  if (slots.includes('dress') || (slots.includes('top') && slots.includes('bottom'))) score += 20;
  if (slots.includes('shoes') && gender === 'male' && slots.includes('dress')) score -= 20;
  if (slots.includes('shoes')) score += 10;
  if (wantsOuterwear(weather, occasion) && slots.includes('jacket')) score += 12;
  if (new Set(slots).size === slots.length) score += 8;
  score += outfit.reduce((sum, item) => sum + occasionScore(item, occasion, wish, weather, gender) / outfit.length, 0);
  score += harmony(outfit.slice(0, -1), outfit[outfit.length - 1]);
  const styles = outfit.map((item) => (item.style ?? '').toLowerCase()).filter(Boolean);
  if (styles.length > 1 && styles.every((style) => style.includes(styles[0].slice(0, 4)) || /casual|minimal/.test(style))) {
    score += 8;
  }
  const loud = outfit.filter((item) => isLoudPattern(item.pattern)).length;
  if (loud > 1) score -= 18;
  return score;
}

function harmony(base: WardrobeItem[], candidate: WardrobeItem) {
  if (!candidate) return 0;
  let score = 4;
  const candidateColors = colorTokens(candidate.color);
  const baseColors = base.flatMap((item) => colorTokens(item.color));
  if (candidateColors.some((color) => isNeutral(color))) score += 10;
  if (candidateColors.some((color) => baseColors.includes(color))) score += 8;
  const baseStyles = base.map((item) => (item.style ?? '').toLowerCase()).filter(Boolean);
  const style = (candidate.style ?? '').toLowerCase();
  if (style && baseStyles.some((value) => value.includes(style) || style.includes(value))) score += 8;
  if (isLoudPattern(candidate.pattern) && base.some((item) => isLoudPattern(item.pattern))) score -= 14;
  return score;
}

function colorTokens(value: string | null) {
  return (value ?? '')
    .toLowerCase()
    .split(/[,/&+]| och | and /)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isNeutral(color: string) {
  return NEUTRALS.some((neutral) => color.includes(neutral));
}

function isLoudPattern(pattern: string | null) {
  const value = (pattern ?? '').toLowerCase();
  return /(blommig|rutig|prickig|animal|leopard|zebra|grafisk|paisley|floral|check|plaid|polka|dot|graphic)/.test(value);
}

function explainOutfit(
  outfit: WardrobeItem[],
  occasion: ReturnType<typeof detectOccasion>,
  weather?: WeatherSnapshot | null,
) {
  const names = outfit.map((item) => item.name).join(', ');
  const colors = [...new Set(outfit.flatMap((item) => colorTokens(item.color)))].slice(0, 3).join(' and ');
  const vibe = occasion === 'evening'
    ? 'work for the evening'
    : occasion === 'formal'
      ? 'work for the office or something more formal'
      : occasion === 'sport'
        ? 'work for a workout'
        : 'go well together for everyday';
  const weatherBit = weather ? ` Suited to ${weather.summary}.` : '';
  return `${names} ${vibe}${colors ? `, in ${colors}` : ''}.${weatherBit}`;
}

function compact(items: (WardrobeItem | undefined)[]) {
  return items.filter((item): item is WardrobeItem => Boolean(item));
}

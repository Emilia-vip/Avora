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
};

export type OutfitSuggestion = {
  items: WardrobeItem[];
  title: string;
  reason: string;
  matchPercent: number;
};

type Slot = 'top' | 'bottom' | 'dress' | 'shoes' | 'jacket' | 'accessory';

const NEUTRALS = [
  'svart', 'vit', 'beige', 'grå', 'gra', 'cream', 'kräm', 'navy', 'marin',
  'brun', 'khaki', 'camel', 'offwhite', 'ivory', 'black', 'white', 'grey', 'gray', 'navy',
];

export function matchOutfitFromWardrobe(items: WardrobeItem[], wish: string): OutfitSuggestion | null {
  if (items.length === 0) return null;

  const occasion = detectOccasion(wish);
  const ranked = [...items]
    .map((item) => ({ item, score: occasionScore(item, occasion, wish) }))
    .sort((left, right) => right.score - left.score);

  const bySlot = new Map<Slot, WardrobeItem[]>();
  for (const { item } of ranked) {
    const slot = toSlot(item.category);
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
      const jacket = occasion === 'casual' ? undefined : bestCompanion([...base, shoe].filter(Boolean) as WardrobeItem[], jackets);
      const accessory = bestCompanion([...base, shoe, jacket].filter(Boolean) as WardrobeItem[], accessories);
      candidates.push(compact([...base, shoe, jacket, accessory]));
    }
  }

  for (const dress of take(dresses, 4)) {
    candidates.push(compact([dress, bestCompanion([dress], shoes), bestCompanion([dress], accessories)]));
  }

  const unique = candidates
    .filter((outfit) => outfit.length >= 2)
    .map((outfit) => ({
      outfit,
      score: scoreOutfit(outfit, occasion, wish),
    }))
    .sort((left, right) => right.score - left.score);

  const winner = unique[0];
  if (!winner) {
    return {
      items: ranked.slice(0, Math.min(3, ranked.length)).map((entry) => entry.item),
      title: titleForOccasion(occasion, wish),
      reason: 'Jag valde de plagg som bäst matchade önskemålet utifrån din garderob.',
      matchPercent: 62,
    };
  }

  return {
    items: winner.outfit,
    title: titleForOccasion(occasion, wish),
    reason: explainOutfit(winner.outfit, occasion),
    matchPercent: Math.max(68, Math.min(97, Math.round(winner.score))),
  };
}

function detectOccasion(wish: string) {
  const text = wish.toLowerCase();
  if (/(dejt|date|middag|dinner|kväll|evening|fest|party|bröllop)/.test(text)) return 'evening';
  if (/(jobb|work|möte|meeting|kontor|office|intervju|business|formell)/.test(text)) return 'formal';
  if (/(träning|gym|sport|workout|löp)/.test(text)) return 'sport';
  if (/(sommar|summer|varm|strand|beach)/.test(text)) return 'summer';
  if (/(vinter|winter|kallt|regn|höst)/.test(text)) return 'cold';
  return 'casual';
}

function titleForOccasion(occasion: ReturnType<typeof detectOccasion>, wish: string) {
  if (wish.trim().length > 2 && wish.trim().length < 28) {
    return wish.trim().charAt(0).toUpperCase() + wish.trim().slice(1);
  }
  switch (occasion) {
    case 'evening':
      return 'Kvällslook';
    case 'formal':
      return 'Jobblook';
    case 'sport':
      return 'Träningslook';
    case 'summer':
      return 'Sommarlook';
    case 'cold':
      return 'Varm look';
    default:
      return 'Vardagslook';
  }
}

function toSlot(category: string): Slot | null {
  const value = category.toLowerCase();
  if (/(klänning|dress)/.test(value)) return 'dress';
  if (/(sko|stövel|sandal|shoe|boot)/.test(value)) return 'shoes';
  if (/(jacka|kappa|blazer|coat|jacket)/.test(value)) return 'jacket';
  if (/(byxa|jeans|kjol|shorts|bottom)/.test(value)) return 'bottom';
  if (/(accessoar|väska|hatt|mössa|bälte|smycke|accessor)/.test(value)) return 'accessory';
  if (/(tröja|skjorta|topp|blus|t-shirt|top|shirt)/.test(value) || value === 'tops') return 'top';
  return null;
}

function occasionScore(item: WardrobeItem, occasion: ReturnType<typeof detectOccasion>, wish: string) {
  let score = 10;
  const haystack = `${item.name} ${item.style} ${item.color} ${item.material} ${item.pattern} ${item.category}`.toLowerCase();
  for (const word of wish.toLowerCase().split(/\s+/).filter((part) => part.length > 3)) {
    if (haystack.includes(word)) score += 12;
  }

  const style = (item.style ?? '').toLowerCase();
  if (occasion === 'evening' && /(elegant|kväll|formell|fest)/.test(style + haystack)) score += 18;
  if (occasion === 'formal' && /(formell|classic|kontor|business|minimal)/.test(style + haystack)) score += 18;
  if (occasion === 'sport' && /(sport|träning|athleisure)/.test(style + haystack)) score += 20;
  if (occasion === 'casual' && /(casual|street|vardag)/.test(style + haystack)) score += 10;
  if (occasion === 'summer' && /(linne|bomull|kort|sommar)/.test(haystack)) score += 12;
  if (occasion === 'cold' && /(ylle|stickat|kappa|jacka|ull)/.test(haystack)) score += 12;
  return score;
}

function bestCompanion(base: WardrobeItem[], options: WardrobeItem[]) {
  if (options.length === 0) return undefined;
  return [...options].sort((left, right) => harmony(base, right) - harmony(base, left))[0];
}

function scoreOutfit(outfit: WardrobeItem[], occasion: ReturnType<typeof detectOccasion>, wish: string) {
  const slots = outfit.map((item) => toSlot(item.category));
  let score = 50;
  if (slots.includes('dress') || (slots.includes('top') && slots.includes('bottom'))) score += 20;
  if (slots.includes('shoes')) score += 10;
  if (new Set(slots).size === slots.length) score += 8;
  score += outfit.reduce((sum, item) => sum + occasionScore(item, occasion, wish) / outfit.length, 0);
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
    .split(/[,/&+]| och /)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isNeutral(color: string) {
  return NEUTRALS.some((neutral) => color.includes(neutral));
}

function isLoudPattern(pattern: string | null) {
  const value = (pattern ?? '').toLowerCase();
  return /(blommig|rutig|prickig|animal|leopard|zebra|grafisk|paisley)/.test(value);
}

function explainOutfit(outfit: WardrobeItem[], occasion: ReturnType<typeof detectOccasion>) {
  const names = outfit.map((item) => item.name).join(', ');
  const colors = [...new Set(outfit.flatMap((item) => colorTokens(item.color)))].slice(0, 3).join(' och ');
  const vibe = occasion === 'evening'
    ? 'för kvällen'
    : occasion === 'formal'
      ? 'till jobb eller mer formellt'
      : occasion === 'sport'
        ? 'för träning'
        : 'som sitter ihop i vardagen';
  return `${names} funkar ${vibe}${colors ? `, med ${colors}` : ''}.`;
}

function compact(items: Array<WardrobeItem | undefined>) {
  return items.filter((item): item is WardrobeItem => Boolean(item));
}

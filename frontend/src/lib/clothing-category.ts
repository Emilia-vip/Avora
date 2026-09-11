export const CLOTHING_CATEGORIES = [
  'Tops',
  'Bottoms',
  'Dresses',
  'Shoes',
  'Jackets',
  'Accessories',
] as const;

export type ClothingCategory = (typeof CLOTHING_CATEGORIES)[number];
export type ClothingSlot = 'top' | 'bottom' | 'dress' | 'shoes' | 'jacket' | 'accessory';

const SLOT_BY_CATEGORY: Record<ClothingCategory, ClothingSlot> = {
  Tops: 'top',
  Bottoms: 'bottom',
  Dresses: 'dress',
  Shoes: 'shoes',
  Jackets: 'jacket',
  Accessories: 'accessory',
};

export function normalizeCategory(value?: string | null): ClothingCategory | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'okänt' || normalized === 'okänt plagg') return null;

  if (/(klänning|dress|jumpsuit|overall)/.test(normalized)) return 'Dresses';
  if (/(sko|stövel|sandal|sneaker|loafer|heel|pump|shoe|boot)/.test(normalized)) return 'Shoes';
  if (/(jacka|kappa|blazer|coat|jacket|kofta|cardigan|väst|overshirt)/.test(normalized)) return 'Jackets';
  if (/(byx|jeans|kjol|short|legging|tights|trouser|pant|chino|kjol|bottom)/.test(normalized)) return 'Bottoms';
  if (/(accessoar|väska|hatt|mössa|bälte|smycke|halsband|örhänge|scarf|sjal|keps|accessor)/.test(normalized)) {
    return 'Accessories';
  }
  if (
    /(tröja|skjorta|topp|blus|t-shirt|tshirt|linne|hoodie|sweater|jumper|top|shirt)/.test(normalized)
    || normalized === 'tops'
  ) {
    return 'Tops';
  }

  return null;
}

export function categorySlot(category: string): ClothingSlot | null {
  const canonical = normalizeCategory(category);
  return canonical ? SLOT_BY_CATEGORY[canonical] : null;
}

export function matchesCategoryFilter(itemCategory: string, filter: string) {
  if (filter === 'All' || filter === 'Alla') return true;
  return normalizeCategory(itemCategory) === filter;
}

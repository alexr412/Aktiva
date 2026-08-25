export interface AvatarStudioConfig {
  skinColor: string;
  top: string;
  hairColor: string;
  clothing: string;
  clothesColor: string;
  eyes: string;
  mouth: string;
  accessories: string;
  backgroundColor: string;
}

export const SKIN_COLOR_OPTIONS = [
  { id: 'edb98a', labelDe: 'Helligkeit 1', labelEn: 'Fair', hex: '#edb98a' },
  { id: 'fd9841', labelDe: 'Helligkeit 2', labelEn: 'Peach', hex: '#fd9841' },
  { id: 'f8d25c', labelDe: 'Helligkeit 3', labelEn: 'Warm', hex: '#f8d25c' },
  { id: 'd08b5b', labelDe: 'Helligkeit 4', labelEn: 'Tan', hex: '#d08b5b' },
  { id: 'ae5d29', labelDe: 'Helligkeit 5', labelEn: 'Bronze', hex: '#ae5d29' },
  { id: '614335', labelDe: 'Helligkeit 6', labelEn: 'Deep', hex: '#614335' },
];

export const TOP_OPTIONS = [
  { id: 'shortFlat', labelDe: 'Kurz Schlicht', labelEn: 'Short Flat' },
  { id: 'shortWavy', labelDe: 'Kurz Wellig', labelEn: 'Short Wavy' },
  { id: 'shortCurly', labelDe: 'Kurz Lockig', labelEn: 'Short Curly' },
  { id: 'dreads01', labelDe: 'Dreads', labelEn: 'Dreads' },
  { id: 'longHair', labelDe: 'Lang Glatt', labelEn: 'Long Straight' },
  { id: 'curly', labelDe: 'Lang Lockig', labelEn: 'Long Curly' },
  { id: 'bun', labelDe: 'Dutt / Bun', labelEn: 'Bun' },
  { id: 'hijab', labelDe: 'Hijab', labelEn: 'Hijab' },
  { id: 'hat', labelDe: 'Mütze', labelEn: 'Hat' },
  { id: 'winterHat02', labelDe: 'Beanie', labelEn: 'Beanie' },
  { id: 'eyepatch', labelDe: 'Augenklappe', labelEn: 'Eyepatch' },
  { id: 'turban', labelDe: 'Turban', labelEn: 'Turban' },
];

export const HAIR_COLOR_OPTIONS = [
  { id: '2c1b18', labelDe: 'Schwarz', labelEn: 'Black', hex: '#2c1b18' },
  { id: '4a312c', labelDe: 'Dunkelbraun', labelEn: 'Dark Brown', hex: '#4a312c' },
  { id: 'a55728', labelDe: 'Kastanienbraun', labelEn: 'Auburn', hex: '#a55728' },
  { id: 'b58143', labelDe: 'Hellbraun', labelEn: 'Light Brown', hex: '#b58143' },
  { id: 'd6b370', labelDe: 'Blond', labelEn: 'Blonde', hex: '#d6b370' },
  { id: 'c93305', labelDe: 'Rot', labelEn: 'Red', hex: '#c93305' },
  { id: 'e8e1e1', labelDe: 'Platin / Grau', labelEn: 'Plat / Silver', hex: '#e8e1e1' },
  { id: '7241ce', labelDe: 'Lila / Neon', labelEn: 'Purple / Neon', hex: '#7241ce' },
];

export const CLOTHING_OPTIONS = [
  { id: 'hoodie', labelDe: 'Hoodie', labelEn: 'Hoodie' },
  { id: 'blazerAndShirt', labelDe: 'Blazer & Hemd', labelEn: 'Blazer & Shirt' },
  { id: 'collarAndSweater', labelDe: 'Pullover', labelEn: 'Sweater' },
  { id: 'graphicShirt', labelDe: 'T-Shirt mit Print', labelEn: 'Graphic Shirt' },
  { id: 'shirtVNeck', labelDe: 'V-Ausschnitt Shirt', labelEn: 'V-Neck' },
  { id: 'overall', labelDe: 'Latzhose / Overall', labelEn: 'Overall' },
];

export const CLOTHES_COLOR_OPTIONS = [
  { id: '65c9ff', labelDe: 'Hellblau', labelEn: 'Light Blue', hex: '#65c9ff' },
  { id: '262e33', labelDe: 'Dunkelgrau', labelEn: 'Dark Charcoal', hex: '#262e33' },
  { id: 'e6e6e6', labelDe: 'Weiß', labelEn: 'White', hex: '#e6e6e6' },
  { id: '25557c', labelDe: 'Marineblau', labelEn: 'Navy', hex: '#25557c' },
  { id: 'e54d42', labelDe: 'Koralle', labelEn: 'Coral', hex: '#e54d42' },
  { id: 'ffae19', labelDe: 'Gelb', labelEn: 'Yellow', hex: '#ffae19' },
  { id: 'b1e5d9', labelDe: 'Mintgrün', labelEn: 'Mint Green', hex: '#b1e5d9' },
  { id: '7241ce', labelDe: 'Violett', labelEn: 'Violet', hex: '#7241ce' },
];

export const EYES_OPTIONS = [
  { id: 'default', labelDe: 'Normal', labelEn: 'Default' },
  { id: 'happy', labelDe: 'Fröhlich', labelEn: 'Happy' },
  { id: 'wink', labelDe: 'Zwinkern', labelEn: 'Wink' },
  { id: 'squint', labelDe: 'Fokussiert', labelEn: 'Squint' },
  { id: 'hearts', labelDe: 'Herzchen', labelEn: 'Hearts' },
  { id: 'surprised', labelDe: 'Überrascht', labelEn: 'Surprised' },
];

export const MOUTH_OPTIONS = [
  { id: 'smile', labelDe: 'Lächeln', labelEn: 'Smile' },
  { id: 'default', labelDe: 'Entspannt', labelEn: 'Default' },
  { id: 'twinkle', labelDe: 'Verschmitzt', labelEn: 'Twinkle' },
  { id: 'tongue', labelDe: 'Zunge raus', labelEn: 'Tongue Out' },
  { id: 'serious', labelDe: 'Ernst', labelEn: 'Serious' },
  { id: 'grimace', labelDe: 'Grinsen', labelEn: 'Grimace' },
];

export const ACCESSORIES_OPTIONS = [
  { id: 'none', labelDe: 'Keine', labelEn: 'None' },
  { id: 'round', labelDe: 'Runde Brille', labelEn: 'Round Glasses' },
  { id: 'prescription02', labelDe: 'Eckige Brille', labelEn: 'Square Glasses' },
  { id: 'sunglasses', labelDe: 'Sonnenbrille', labelEn: 'Sunglasses' },
  { id: 'wayfarers', labelDe: 'Cool / Wayfarer', labelEn: 'Wayfarers' },
];

export const BACKGROUND_COLOR_OPTIONS = [
  { id: 'b6e3f4', labelDe: 'Himmelblau', labelEn: 'Sky Blue', hex: '#b6e3f4' },
  { id: 'ffd5dc', labelDe: 'Rosa', labelEn: 'Rose', hex: '#ffd5dc' },
  { id: 'c0aede', labelDe: 'Flieder', labelEn: 'Lavender', hex: '#c0aede' },
  { id: 'ffdfbf', labelDe: 'Pfirsich', labelEn: 'Peach', hex: '#ffdfbf' },
  { id: 'd1d4f9', labelDe: 'Perlweiß/Perlblau', labelEn: 'Ice Blue', hex: '#d1d4f9' },
  { id: 'b1e5d9', labelDe: 'Pastellgrün', labelEn: 'Mint', hex: '#b1e5d9' },
  { id: 'fbe7c6', labelDe: 'Creme', labelEn: 'Cream', hex: '#fbe7c6' },
  { id: '1a1a2e', labelDe: 'Midnight Dark', labelEn: 'Midnight', hex: '#1a1a2e' },
];

export const DEFAULT_STUDIO_CONFIG: AvatarStudioConfig = {
  skinColor: 'edb98a',
  top: 'shortFlat',
  hairColor: '4a312c',
  clothing: 'hoodie',
  clothesColor: '65c9ff',
  eyes: 'happy',
  mouth: 'smile',
  accessories: 'none',
  backgroundColor: 'b6e3f4',
};

export function buildDicebearStudioUrl(config: AvatarStudioConfig): string {
  const params = new URLSearchParams();
  params.append('skinColor', config.skinColor);
  params.append('top', config.top);
  params.append('hairColor', config.hairColor);
  params.append('clothing', config.clothing);
  params.append('clothesColor', config.clothesColor);
  params.append('eyes', config.eyes);
  params.append('mouth', config.mouth);
  if (config.accessories && config.accessories !== 'none') {
    params.append('accessories', config.accessories);
    params.append('accessoriesProbability', '100');
  } else {
    params.append('accessoriesProbability', '0');
  }
  params.append('backgroundColor', config.backgroundColor);

  return `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
}

export function getRandomAvatarConfig(): AvatarStudioConfig {
  const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  return {
    skinColor: getRandom(SKIN_COLOR_OPTIONS).id,
    top: getRandom(TOP_OPTIONS).id,
    hairColor: getRandom(HAIR_COLOR_OPTIONS).id,
    clothing: getRandom(CLOTHING_OPTIONS).id,
    clothesColor: getRandom(CLOTHES_COLOR_OPTIONS).id,
    eyes: getRandom(EYES_OPTIONS).id,
    mouth: getRandom(MOUTH_OPTIONS).id,
    accessories: getRandom(ACCESSORIES_OPTIONS).id,
    backgroundColor: getRandom(BACKGROUND_COLOR_OPTIONS).id,
  };
}

/**
 * Central Social Media Link Configuration.
 * Strictly uses configured environment variables. If a URL is missing or empty,
 * it returns null/undefined so components do NOT render invalid or invented social links.
 */

export interface SocialLinkItem {
  id: 'instagram' | 'tiktok' | 'facebook';
  label: string;
  url: string;
}

export function getSocialLinks(): SocialLinkItem[] {
  const links: SocialLinkItem[] = [];

  const instagramUrl = process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM?.trim();
  if (instagramUrl) {
    links.push({
      id: 'instagram',
      label: 'Instagram',
      url: instagramUrl,
    });
  }

  const tiktokUrl = process.env.NEXT_PUBLIC_SOCIAL_TIKTOK?.trim();
  if (tiktokUrl) {
    links.push({
      id: 'tiktok',
      label: 'TikTok',
      url: tiktokUrl,
    });
  }

  const facebookUrl = process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK?.trim();
  if (facebookUrl) {
    links.push({
      id: 'facebook',
      label: 'Facebook',
      url: facebookUrl,
    });
  }

  return links;
}

import { Home, Compass, MessageCircle, User } from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  href: string;
  labelDe: string;
  labelEn: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: '/', labelDe: 'Entdecken', labelEn: 'Discover', icon: Home },
  { href: '/explore', labelDe: 'Erkunden', labelEn: 'Explore', icon: Compass },
  { href: '/chat', labelDe: 'Chat', labelEn: 'Chat', icon: MessageCircle },
  { href: '/profile', labelDe: 'Profil', labelEn: 'Profile', icon: User },
];

export function getIsActiveNav(href: string, pathname: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

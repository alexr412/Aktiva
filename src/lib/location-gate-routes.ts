/** Location is a prerequisite for discovery, never for existing conversations or account settings. */
export function needsLocationForRoute(pathname: string): boolean {
  return !['/chat', '/profile', '/users', '/settings', '/onboarding', '/reset-password', '/auth/action'].some(route => pathname === route || pathname.startsWith(`${route}/`));
}

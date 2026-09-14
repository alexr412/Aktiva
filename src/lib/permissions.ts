export type UserRole = 'user' | 'creator' | 'supporter' | 'moderator' | 'finance' | 'admin' | 'superadmin';

export const VALID_USER_ROLES: readonly UserRole[] = [
  'user',
  'creator',
  'supporter',
  'moderator',
  'finance',
  'admin',
  'superadmin'
] as const;

export function normalizeRole(role?: string | null): UserRole {
  if (!role || typeof role !== 'string') return 'user';
  const cleanRole = role.trim().toLowerCase() as UserRole;
  if (VALID_USER_ROLES.includes(cleanRole)) {
    return cleanRole;
  }
  return 'user';
}

export function canViewAdminDashboard(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'moderator' || norm === 'finance' || norm === 'admin' || norm === 'superadmin';
}

export function canModerateContent(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'moderator' || norm === 'admin' || norm === 'superadmin';
}

export function canManageUsers(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'admin' || norm === 'superadmin';
}

export function canManagePayments(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'finance' || norm === 'admin' || norm === 'superadmin';
}

export function canApproveCreators(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'admin' || norm === 'superadmin';
}

export function canViewUsageMetrics(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'admin' || norm === 'superadmin';
}

export function canManageSystem(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'admin' || norm === 'superadmin';
}

export function canReviewKyc(role?: string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'admin' || norm === 'superadmin';
}

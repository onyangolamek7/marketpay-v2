import type { AuthState, Role, User } from './types';
import { KYC_ROLES } from './types';

/** Where each role lands once its account is fully active. */
export const ROLE_HOME: Record<Role, string> = {
  consumer: '/dashboard/consumer',
  retailer: '/dashboard/retailer',
  wholesaler: '/dashboard/wholesaler',
  rider: '/dashboard/rider',
  gov_analyst: '/dashboard/gov-analyst',
  admin: '/dashboard/admin',
};

/**
 * Single derivation of "what can this person see". Components read this rather
 * than each re-deciding from status + kyc_status.
 */
export function deriveState(user: User | null): AuthState {
  if (!user) return 'UNAUTHENTICATED';
  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') return 'ACCOUNT_SUSPENDED';
  if (user.status === 'LOCKED') return 'ACCOUNT_LOCKED';
  if (user.status === 'PENDING_VERIFICATION') return 'KYC_REQUIRED';

  if (KYC_ROLES.includes(user.role)) {
    if (!user.kyc_status || user.kyc_status === 'PENDING') return 'KYC_REQUIRED';
    if (user.kyc_status === 'SUBMITTED') return 'KYC_PENDING';
    if (user.kyc_status === 'REJECTED' || user.kyc_status === 'NEEDS_MORE_INFO') {
      return 'KYC_REQUIRED';
    }
  }
  return 'AUTHENTICATED';
}

/** The destination for a freshly authenticated user, given their state. */
export function destinationFor(user: User | null): string {
  switch (deriveState(user)) {
    case 'AUTHENTICATED':
      return ROLE_HOME[user!.role];
    case 'KYC_REQUIRED':
    case 'KYC_PENDING':
      return '/kyc';
    case 'ACCOUNT_SUSPENDED':
    case 'ACCOUNT_LOCKED':
      return '/account-status';
    default:
      return '/login';
  }
}

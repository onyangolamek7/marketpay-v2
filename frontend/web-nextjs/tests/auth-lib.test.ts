import { describe, expect, it } from 'vitest';
import { AuthError, normalizeErrors } from '@/lib/auth/errors';
import { deriveState, destinationFor, ROLE_HOME } from '@/lib/auth/routes';
import {
  findCountry,
  maskEmail,
  maskPhone,
  toE164,
  validateEmail,
  validateFullName,
  validateOtp,
  validatePassword,
  validatePhone,
} from '@/lib/auth/validation';
import type { Role, User } from '@/lib/auth/types';
import { makeUser } from './helpers';

describe('phone handling', () => {
  const kenya = findCountry('KE');

  it('builds E.164 from a locally typed number, dropping the trunk zero', () => {
    expect(toE164(kenya, '0712 345 678')).toBe('+254712345678');
    expect(toE164(kenya, '712-345-678')).toBe('+254712345678');
  });

  it('rejects numbers of the wrong length for the chosen country', () => {
    expect(validatePhone(kenya, '712345678')).toBeNull();
    expect(validatePhone(kenya, '71234')).toMatch(/valid Kenya number/);
    expect(validatePhone(kenya, '')).toMatch(/Enter your phone number/);
  });

  it('defaults to Kenya for the launch market and for unknown codes', () => {
    expect(findCountry('KE').dial).toBe('+254');
    expect(findCountry('ZZ').iso).toBe('KE');
  });

  it('masks all but the last three digits', () => {
    const masked = maskPhone('+254712345678');
    expect(masked).toMatch(/678$/);
    expect(masked).not.toContain('712345');
    expect(maskEmail('amina@example.com')).toBe('a•••@example.com');
  });
});

describe('password rules', () => {
  it.each([
    ['short1!A', null],
    ['Sh0rt!', 'too short'],
    ['alllower1!', 'no uppercase'],
    ['NoDigits!!', 'no digit'],
    ['NoSymbol123', 'no symbol'],
  ])('%s', (value, failure) => {
    const result = validatePassword(value);
    if (failure === null) expect(result).toBeNull();
    else expect(result).not.toBeNull();
  });

  it('accepts a password meeting every requirement', () => {
    expect(validatePassword('Mombasa2024!')).toBeNull();
  });
});

describe('other field validation', () => {
  it('bounds the full name at 2 to 100 characters and allows unicode', () => {
    expect(validateFullName('Wanjiku Njoroge')).toBeNull();
    expect(validateFullName('Ayọ̀ Adébáyọ̀')).toBeNull();
    expect(validateFullName('A')).not.toBeNull();
    expect(validateFullName('x'.repeat(101))).not.toBeNull();
  });

  it('treats email as optional only when it is not required', () => {
    expect(validateEmail('', false)).toBeNull();
    expect(validateEmail('', true)).not.toBeNull();
    expect(validateEmail('not-an-email', false)).not.toBeNull();
    expect(validateEmail('amina@example.com', true)).toBeNull();
  });

  it('requires exactly six digits for an OTP', () => {
    expect(validateOtp('123456')).toBeNull();
    expect(validateOtp('12345')).not.toBeNull();
    expect(validateOtp('12345a')).not.toBeNull();
  });
});

describe('error normalisation', () => {
  it('maps a status to a safe code when the backend sends none', () => {
    expect(normalizeErrors(401, []).code).toBe('INVALID_CREDENTIALS');
    expect(normalizeErrors(429, []).code).toBe('RATE_LIMITED');
    expect(normalizeErrors(500, []).code).toBe('SERVER_ERROR');
  });

  it('never shows a backend message for a code it owns copy for', () => {
    const error = normalizeErrors(401, [
      { error_code: 'INVALID_CREDENTIALS', message: 'User matching query does not exist.' },
    ]);
    expect(error.message).not.toContain('query');
    expect(error.message).toMatch(/not correct/);
  });

  it('collects field errors and attempt counts', () => {
    const error = normalizeErrors(
      400,
      [
        { error_code: 'VALIDATION_ERROR' },
        { field: 'phone_number', message: 'Already registered.' },
      ],
      undefined,
      { attempts_remaining: 3 }
    );
    expect(error.fieldErrors.phone_number).toBe('Already registered.');
    expect(error.attemptsRemaining).toBe(3);
  });

  it('flags lockouts and retryable failures distinctly', () => {
    expect(new AuthError('ACCOUNT_LOCKED', '').isLockout).toBe(true);
    expect(new AuthError('TOO_MANY_ATTEMPTS', '').isLockout).toBe(true);
    expect(new AuthError('NETWORK_ERROR', '').isRetryable).toBe(true);
    expect(new AuthError('INVALID_CREDENTIALS', '').isRetryable).toBe(false);
  });
});

describe('state derivation and role routing', () => {
  it('sends each fully active role to its own home', () => {
    const roles: Role[] = ['consumer', 'retailer', 'wholesaler', 'rider', 'gov_analyst', 'admin'];
    for (const role of roles) {
      const user = makeUser({ role, kyc_status: 'APPROVED' });
      expect(destinationFor(user)).toBe(ROLE_HOME[role]);
    }
  });

  it('holds elevated roles at KYC until they are approved', () => {
    const retailer = (kyc: User['kyc_status']) => makeUser({ role: 'retailer', kyc_status: kyc });
    expect(deriveState(retailer('PENDING'))).toBe('KYC_REQUIRED');
    expect(deriveState(retailer('SUBMITTED'))).toBe('KYC_PENDING');
    expect(deriveState(retailer('NEEDS_MORE_INFO'))).toBe('KYC_REQUIRED');
    expect(deriveState(retailer('REJECTED'))).toBe('KYC_REQUIRED');
    expect(deriveState(retailer('APPROVED'))).toBe('AUTHENTICATED');
    expect(destinationFor(retailer('SUBMITTED'))).toBe('/kyc');
  });

  it('does not gate a consumer on KYC', () => {
    expect(deriveState(makeUser({ role: 'consumer', kyc_status: null }))).toBe('AUTHENTICATED');
  });

  it('routes blocked and unverified accounts away from the dashboards', () => {
    expect(deriveState(makeUser({ status: 'SUSPENDED' }))).toBe('ACCOUNT_SUSPENDED');
    expect(deriveState(makeUser({ status: 'LOCKED' }))).toBe('ACCOUNT_LOCKED');
    expect(deriveState(makeUser({ status: 'PENDING_VERIFICATION' }))).toBe('KYC_REQUIRED');
    expect(destinationFor(makeUser({ status: 'SUSPENDED' }))).toBe('/account-status');
    expect(deriveState(null)).toBe('UNAUTHENTICATED');
    expect(destinationFor(null)).toBe('/login');
  });
});

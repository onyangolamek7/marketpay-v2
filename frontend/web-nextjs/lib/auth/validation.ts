// Client-side validation. Fast feedback only — the API Gateway stays authoritative.

export interface Country {
  iso: string;
  name: string;
  dial: string;
  /** National significant number length, used for a cheap length check. */
  nsnLength: number[];
  flag: string;
  example: string;
}

/** Launch markets first; Kenya is the default. */
export const COUNTRIES: Country[] = [
  { iso: 'KE', name: 'Kenya', dial: '+254', nsnLength: [9], flag: '🇰🇪', example: '712 345 678' },
  { iso: 'NG', name: 'Nigeria', dial: '+234', nsnLength: [10], flag: '🇳🇬', example: '802 123 4567' },
  { iso: 'ET', name: 'Ethiopia', dial: '+251', nsnLength: [9], flag: '🇪🇹', example: '911 234 567' },
  { iso: 'TZ', name: 'Tanzania', dial: '+255', nsnLength: [9], flag: '🇹🇿', example: '712 345 678' },
  { iso: 'UG', name: 'Uganda', dial: '+256', nsnLength: [9], flag: '🇺🇬', example: '712 345 678' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function findCountry(iso: string): Country {
  return COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY;
}

/** Combine a country and a locally-typed number into E.164, or null if unusable. */
export function toE164(country: Country, national: string): string | null {
  const digits = national.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return null;
  const e164 = `${country.dial}${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

export function validatePhone(country: Country, national: string): string | null {
  const digits = national.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return 'Enter your phone number.';
  if (!country.nsnLength.includes(digits.length)) {
    return `Enter a valid ${country.name} number, for example ${country.example}.`;
  }
  return toE164(country, national) ? null : 'Enter a valid phone number.';
}

/** Show only the last 3 digits: "+254 ••• ••• 482". */
export function maskPhone(e164: string): string {
  if (!e164) return '•••';
  const tail = e164.slice(-3);
  const dial = e164.slice(0, Math.max(e164.length - 9, 2));
  return `${dial} ••• ••• ${tail}`;
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return '•••';
  return `${name.slice(0, 1)}•••@${domain}`;
}

export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'digit', label: 'One number', test: (v) => /\d/.test(v) },
  { id: 'symbol', label: 'One symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function validatePassword(value: string): string | null {
  if (!value) return 'Create a password.';
  const failed = PASSWORD_RULES.filter((r) => !r.test(value));
  return failed.length === 0 ? null : 'Your password does not meet all the requirements yet.';
}

export function validateFullName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter your full name.';
  if (trimmed.length < 2 || trimmed.length > 100) return 'Use between 2 and 100 characters.';
  return null;
}

export function validateEmail(value: string, required: boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? 'Enter your email address.' : null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) ? null : 'Enter a valid email address.';
}

export function validateOtp(value: string): string | null {
  return /^\d{6}$/.test(value) ? null : 'Enter the 6-digit code.';
}

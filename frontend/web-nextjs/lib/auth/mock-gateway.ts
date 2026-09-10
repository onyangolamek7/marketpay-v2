/**
 * DEVELOPMENT ONLY — in-memory stand-in for the Django API Gateway.
 *
 * The gateway does not yet expose /api/v1/auth/*, so this module lets the real
 * UI run end to end against the documented contract (docs/AUTH_API_CONTRACT.md).
 * It is reachable only from the server-side proxy in app/api/v1/[...path], which
 * routes here only when AUTH_MOCK=1 and NODE_ENV is not production — so a
 * production build can never reach it. Deleting this file and unsetting
 * AUTH_MOCK is the whole migration to the real backend.
 */
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { ApiErrorDetail, KycStatus, Role, User } from './types';
import { KYC_ROLES } from './types';
import { maskEmail, maskPhone } from './validation';

export interface MockResult {
  status: number;
  body: { data: unknown; meta?: Record<string, unknown>; errors?: ApiErrorDetail[] };
}

interface Account {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  passwordHash: string;
  role: Role;
  status: User['status'];
  kyc_status: KycStatus | null;
  kyc_reason: string | null;
  mfa_enabled: boolean;
  location: string | null;
  failedMfa: number;
  lockedUntil: number;
}

// ponytail: process-local state, resets on reload. Real persistence is the backend's job.
const accounts = new Map<string, Account>();
const otps = new Map<string, { code: string; expires: number; attempts: number }>();
const forgotHits = new Map<string, number[]>();
const denylist = new Set<string>();

const OTP_TTL_MS = 5 * 60_000;
const MFA_TTL_MS = 3 * 60_000;
const LOCKOUT_MS = 15 * 60_000;
const MFA_ENFORCED: Role[] = ['retailer', 'wholesaler', 'admin', 'gov_analyst'];

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

const ok = (data: unknown, meta?: Record<string, unknown>): MockResult => ({
  status: 200,
  body: { data, meta },
});

const fail = (status: number, error_code: string, field?: string): MockResult => ({
  status,
  body: { data: null, errors: [{ error_code, field }] },
});

function challengeShape() {
  return { expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(), resend_after: 30 };
}

function issueOtp(key: string, label: string) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  otps.set(key, { code, expires: Date.now() + OTP_TTL_MS, attempts: 0 });
  // Server terminal only. This value never reaches the browser or a client log.
  console.info(`[AUTH_MOCK] ${label} code for ${key}: ${code}`);
}

function checkOtp(key: string, code: string): MockResult | null {
  const record = otps.get(key);
  if (!record) return fail(400, 'OTP_EXPIRED');
  if (Date.now() > record.expires) {
    otps.delete(key);
    return fail(400, 'OTP_EXPIRED');
  }
  if (record.attempts >= 5) return fail(429, 'TOO_MANY_ATTEMPTS');
  if (record.code !== code) {
    record.attempts += 1;
    return fail(400, 'INVALID_OTP');
  }
  otps.delete(key);
  return null;
}

function toUser(a: Account): User {
  return {
    id: a.id,
    full_name: a.full_name,
    phone_number: maskPhone(a.phone),
    email: a.email,
    role: a.role,
    status: a.status,
    kyc_status: a.kyc_status,
    kyc_reason: a.kyc_reason,
    mfa_enabled: a.mfa_enabled,
    location: a.location,
  };
}

/** JWT-shaped but unsigned: enough for middleware to read a role in development. */
function token(a: Account, kind: 'access' | 'refresh'): string {
  const ttl = kind === 'access' ? 900 : 604_800;
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return [
    part({ alg: 'none', typ: 'JWT' }),
    part({
      user_id: a.id,
      role: a.role,
      exp: Math.floor(Date.now() / 1000) + ttl,
      jti: randomUUID(),
    }),
    'development',
  ].join('.');
}

function session(a: Account): MockResult {
  return ok({
    mfa_required: false,
    user: toUser(a),
    access_token: token(a, 'access'),
    refresh_token: token(a, 'refresh'),
  });
}

function readToken(bearer: string | null): Account | null {
  if (!bearer) return null;
  try {
    const raw = bearer.replace(/^Bearer /, '');
    if (denylist.has(raw)) return null;
    const payload = JSON.parse(Buffer.from(raw.split('.')[1], 'base64url').toString());
    if (payload.exp * 1000 < Date.now()) return null;
    return [...accounts.values()].find((a) => a.id === payload.user_id) ?? null;
  } catch {
    return null;
  }
}

function mfaMethods(a: Account) {
  const methods: { type: 'sms' | 'email'; destination_masked: string }[] = [
    { type: 'sms', destination_masked: maskPhone(a.phone) },
  ];
  if (a.email) methods.push({ type: 'email', destination_masked: maskEmail(a.email) });
  return methods;
}

export async function handleMock(
  path: string,
  method: string,
  readBody: () => Promise<Record<string, unknown>>,
  headers: Headers
): Promise<MockResult> {
  const body = method === 'GET' ? {} : await readBody();
  const str = (k: string) => String(body[k] ?? '');

  switch (`${method} ${path}`) {
    case 'POST auth/register': {
      const phone = str('phone_number');
      if (accounts.has(phone)) return fail(409, 'PHONE_TAKEN', 'phone_number');
      const email = str('email') || null;
      if (email && [...accounts.values()].some((a) => a.email === email)) {
        return fail(409, 'EMAIL_TAKEN', 'email');
      }
      const role = str('role') as Role;
      const account: Account = {
        id: randomUUID(),
        full_name: str('full_name'),
        phone,
        email,
        passwordHash: hash(str('password')),
        role,
        status: 'PENDING_VERIFICATION',
        kyc_status: KYC_ROLES.includes(role) ? 'PENDING' : null,
        kyc_reason: null,
        mfa_enabled: MFA_ENFORCED.includes(role),
        location: str('location') || null,
        failedMfa: 0,
        lockedUntil: 0,
      };
      accounts.set(phone, account);
      return ok({ user_id: account.id, status: account.status });
    }

    case 'POST auth/otp/send': {
      const phone = str('phone_number');
      // Neutral: the response never reveals whether the number is registered.
      if (accounts.has(phone)) issueOtp(phone, 'Registration');
      return ok({ destination_masked: maskPhone(phone), ...challengeShape() });
    }

    case 'POST auth/otp/verify': {
      const phone = str('phone_number');
      const bad = checkOtp(phone, str('code'));
      if (bad) return bad;
      const account = accounts.get(phone);
      if (!account) return fail(400, 'INVALID_OTP');
      if (str('purpose') === 'password_reset') return ok({ reset_token_issued: true });
      if (account.status === 'PENDING_VERIFICATION') account.status = 'ACTIVE';
      return session(account);
    }

    case 'POST auth/login': {
      const account = accounts.get(str('phone_number'));
      if (!account || account.passwordHash !== hash(str('password'))) {
        return fail(401, 'INVALID_CREDENTIALS');
      }
      if (account.lockedUntil > Date.now()) return fail(423, 'ACCOUNT_LOCKED');
      if (account.status === 'SUSPENDED' || account.status === 'DEACTIVATED') {
        return fail(403, 'ACCOUNT_SUSPENDED');
      }
      if (!account.mfa_enabled) return session(account);

      account.failedMfa = 0;
      issueOtp(`mfa:${account.phone}`, 'MFA');
      return ok({
        mfa_required: true,
        mfa_token: token(account, 'access'),
        challenge: {
          methods: mfaMethods(account),
          expires_at: new Date(Date.now() + MFA_TTL_MS).toISOString(),
          attempts_remaining: 5,
        },
      });
    }

    case 'POST auth/mfa/challenge': {
      const account = readToken(headers.get('x-mfa-token'));
      if (!account) return fail(401, 'MFA_EXPIRED');
      issueOtp(`mfa:${account.phone}`, 'MFA');
      return ok({ destination_masked: maskPhone(account.phone), ...challengeShape() });
    }

    case 'POST auth/mfa/verify': {
      const account = readToken(headers.get('x-mfa-token'));
      if (!account) return fail(401, 'MFA_EXPIRED');
      if (account.lockedUntil > Date.now()) return fail(423, 'ACCOUNT_LOCKED');
      if (str('method') === 'totp') {
        // Real TOTP verification lives in the backend; development accepts any 6 digits.
        if (!/^\d{6}$/.test(str('code'))) return fail(400, 'INVALID_OTP');
        return session(account);
      }
      const bad = checkOtp(`mfa:${account.phone}`, str('code'));
      if (bad) {
        account.failedMfa += 1;
        if (account.failedMfa >= 5) {
          account.lockedUntil = Date.now() + LOCKOUT_MS;
          return fail(423, 'ACCOUNT_LOCKED');
        }
        bad.body.meta = { attempts_remaining: 5 - account.failedMfa };
        return bad;
      }
      account.failedMfa = 0;
      return session(account);
    }

    case 'POST auth/mfa/setup': {
      const account = readToken(headers.get('authorization'));
      if (!account) return fail(401, 'SESSION_EXPIRED');
      return ok({
        provisioning_uri: `otpauth://totp/MarketPay:${account.id}?issuer=MarketPay&secret=DEVELOPMENTONLY`,
        manual_key: 'DEVE LOPM ENTO NLYK',
      });
    }

    case 'PATCH auth/mfa/setup': {
      const account = readToken(headers.get('authorization'));
      if (!account) return fail(401, 'SESSION_EXPIRED');
      if (!/^\d{6}$/.test(str('code'))) return fail(400, 'INVALID_OTP');
      account.mfa_enabled = true;
      return ok({ enabled: true });
    }

    case 'POST auth/token/refresh': {
      const refresh = str('refresh_token');
      const account = readToken(`Bearer ${refresh}`);
      if (!account) return fail(401, 'SESSION_EXPIRED');
      denylist.add(refresh);
      return ok({
        access_token: token(account, 'access'),
        refresh_token: token(account, 'refresh'),
      });
    }

    case 'POST auth/logout': {
      const refresh = str('refresh_token');
      if (refresh) denylist.add(refresh);
      return ok(null);
    }

    case 'POST auth/password/forgot': {
      const phone = str('phone_number');
      const hits = (forgotHits.get(phone) ?? []).filter((t) => Date.now() - t < 3_600_000);
      if (hits.length >= 3) return fail(429, 'RATE_LIMITED');
      forgotHits.set(phone, [...hits, Date.now()]);
      if (accounts.has(phone)) issueOtp(phone, 'Password reset');
      return ok({ destination_masked: maskPhone(phone), ...challengeShape() });
    }

    case 'POST auth/password/reset': {
      const phone = str('phone_number');
      const bad = checkOtp(phone, str('code'));
      if (bad) return bad;
      const account = accounts.get(phone);
      if (!account) return fail(400, 'INVALID_OTP');
      account.passwordHash = hash(str('new_password'));
      account.lockedUntil = 0;
      return ok(null);
    }

    case 'POST auth/password/change': {
      const account = readToken(headers.get('authorization'));
      if (!account) return fail(401, 'SESSION_EXPIRED');
      if (account.passwordHash !== hash(str('current_password'))) {
        return fail(400, 'INVALID_CREDENTIALS', 'current_password');
      }
      account.passwordHash = hash(str('new_password'));
      return ok(null);
    }

    case 'GET users/me': {
      const account = readToken(headers.get('authorization'));
      return account ? ok(toUser(account)) : fail(401, 'SESSION_EXPIRED');
    }

    case 'PATCH users/me': {
      const account = readToken(headers.get('authorization'));
      if (!account) return fail(401, 'SESSION_EXPIRED');
      if (body.full_name !== undefined) account.full_name = str('full_name');
      if (body.email !== undefined) account.email = str('email') || null;
      if (body.location !== undefined) account.location = str('location') || null;
      return ok(toUser(account));
    }

    case 'GET users/kyc': {
      const account = readToken(headers.get('authorization'));
      if (!account) return fail(401, 'SESSION_EXPIRED');
      return ok({ status: account.kyc_status ?? 'PENDING', reason: account.kyc_reason });
    }

    case 'POST users/kyc': {
      const account = readToken(headers.get('authorization'));
      if (!account) return fail(401, 'SESSION_EXPIRED');
      account.kyc_status = 'SUBMITTED';
      account.kyc_reason = null;
      return ok({ status: account.kyc_status, submitted_at: new Date().toISOString() });
    }

    default:
      return fail(404, 'SERVER_ERROR');
  }
}

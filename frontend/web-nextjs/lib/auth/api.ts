import { AuthError, normalizeErrors } from './errors';
import type {
  ApiEnvelope,
  DocumentType,
  KycSubmission,
  LoginResult,
  MfaType,
  OtpChallenge,
  PublicRole,
  TotpSetup,
  User,
} from './types';

/**
 * Every authenticated call goes to this app's own /api/v1 route, which proxies
 * to the API Gateway and keeps access/refresh tokens in httpOnly cookies. The
 * browser therefore never holds a token, and no component calls fetch directly.
 */
const BASE = '/api/v1';

type Method = 'GET' | 'POST' | 'PATCH';

async function request<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    const isForm = body instanceof FormData;
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: isForm || body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new AuthError('NETWORK_ERROR', 'Unable to connect to MarketPay. Check your connection and try again.');
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }

  if (!response.ok) {
    const retryHeader = response.headers.get('Retry-After');
    throw normalizeErrors(
      response.status,
      envelope?.errors,
      retryHeader ? Number(retryHeader) : undefined,
      envelope?.meta
    );
  }

  return (envelope?.data ?? null) as T;
}

export interface RegisterPayload {
  full_name: string;
  phone_number: string;
  email?: string;
  password: string;
  role: PublicRole;
  location?: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<{ user_id: string; status: string }>('/auth/register', 'POST', payload),

  sendOtp: (phone_number: string, purpose: 'registration' | 'password_reset') =>
    request<OtpChallenge>('/auth/otp/send', 'POST', { phone_number, purpose }),

  verifyOtp: (phone_number: string, code: string, purpose: 'registration' | 'password_reset') =>
    request<{ user: User } | { reset_token_issued: true }>('/auth/otp/verify', 'POST', {
      phone_number,
      code,
      purpose,
    }),

  login: (phone_number: string, password: string) =>
    request<LoginResult>('/auth/login', 'POST', { phone_number, password }),

  /** Ask the backend to deliver a code for the chosen second factor. */
  sendMfaChallenge: (method: MfaType) =>
    request<OtpChallenge>('/auth/mfa/challenge', 'POST', { method }),

  verifyMfa: (method: MfaType, code: string) =>
    request<{ user: User }>('/auth/mfa/verify', 'POST', { method, code }),

  setupTotp: () => request<TotpSetup>('/auth/mfa/setup', 'POST', { method: 'totp' }),

  confirmTotp: (code: string) => request<{ enabled: true }>('/auth/mfa/setup', 'PATCH', { code }),

  logout: () => request<null>('/auth/logout', 'POST'),

  forgotPassword: (phone_number: string) =>
    request<OtpChallenge>('/auth/password/forgot', 'POST', { phone_number }),

  resetPassword: (phone_number: string, code: string, new_password: string) =>
    request<null>('/auth/password/reset', 'POST', { phone_number, code, new_password }),

  changePassword: (current_password: string, new_password: string) =>
    request<null>('/auth/password/change', 'POST', { current_password, new_password }),

  me: () => request<User>('/users/me'),

  updateMe: (patch: Partial<Pick<User, 'full_name' | 'email' | 'location'>>) =>
    request<User>('/users/me', 'PATCH', patch),

  submitKyc: (documentType: DocumentType, files: File[]) => {
    const form = new FormData();
    form.set('document_type', documentType);
    for (const file of files) form.append('documents', file);
    return request<KycSubmission>('/users/kyc', 'POST', form);
  },

  kycStatus: () => request<KycSubmission>('/users/kyc'),
};

export { AuthError };
